"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { completeCharge, expireStaleChargeOrders } from "@/lib/charge";
import { expireStaleRentals } from "@/lib/rentals";
import { adjustPoint, InsufficientPointError } from "@/lib/points";
import {
  REFUND_CARD,
  REFUND_POINT,
  hasPendingRental,
  refundableCardOrders,
  refundCardOrder,
  refundSplit,
  resolvePendingRefund,
} from "@/lib/card-refund";
import { chargeAmount } from "@/lib/config";

/**
 * 방치된 건 정리를 관리자가 수동 실행. (/api/cron/sweep 과 같은 작업 — 크론 미설정 시 대체)
 *  · 만료된 SMS 발급건: 코드 도착했으면 정산, 아니면 5sim 취소(원가 환불)
 *  · 자동매칭 기간이 지난 미입금 충전 주문: 취소
 */
export async function runSweep() {
  await requireAdmin();

  // 한쪽이 실패해도 다른 쪽은 진행
  const [, charges] = await Promise.allSettled([
    expireStaleRentals(),
    expireStaleChargeOrders(),
  ]);
  const canceled = charges.status === "fulfilled" ? charges.value : 0;

  revalidatePath("/admin");
  revalidatePath("/admin/rentals");
  revalidatePath("/admin/charges");
  redirect(`/admin?swept=${canceled}`);
}

/** 입금확인 → 포인트 지급 (멱등) */
export async function confirmCharge(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));

  await completeCharge(id);

  revalidatePath("/admin");
  revalidatePath("/admin/charges");
  revalidatePath("/admin/inquiries");
}

/**
 * 미매칭 입금을 관리자가 특정 충전 주문에 직접 연결하고 지급 처리.
 * 자동매칭은 입금자명이 정확히 일치해야 걸리므로, 이름이 다른 입금은
 * completeCharge 의 소급연결로도 해소되지 않는다 → 여기서 명시적으로 연결한다.
 * 멱등: 이미 매칭된 입금이거나 취소된 주문이면 아무 변화 없음.
 */
export async function matchDeposit(formData: FormData) {
  await requireAdmin();
  const depositId = Number(formData.get("depositId"));
  const orderId = Number(formData.get("orderId"));
  if (!depositId || !orderId) return;

  const [deposit, order] = await Promise.all([
    prisma.depositLog.findUnique({ where: { id: depositId } }),
    prisma.chargeOrder.findUnique({ where: { id: orderId } }),
  ]);
  if (!deposit || deposit.matched || !order || order.status === "CANCELED") {
    revalidatePath("/admin/charges");
    return;
  }

  // 주문이 아직 대기면 지급(멱등). 이미 지급된 주문에 사후 연결만 하는 것도 허용.
  if (!order.charged) await completeCharge(orderId, deposit.amount);

  // 이 입금로그를 선택한 주문에 매칭 표시(경합 대비 matched:false 가드)
  await prisma.depositLog.updateMany({
    where: { id: depositId, matched: false },
    data: { matched: true, matchedOrderId: orderId },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/charges");
  revalidatePath("/admin/inquiries");
}

/**
 * 미매칭 입금을 주문 연결 없이 "수동 확인"으로 표시(미매칭 해제).
 * 같은 금액의 주문이 아예 없는(금액 파싱 오류·환불 등) 입금을 목록에서 정리할 때 사용.
 * 포인트 지급은 하지 않는다 — 표시만 matched=true 로 바꾼다(matchedOrderId 는 null 유지).
 */
export async function dismissDeposit(formData: FormData) {
  await requireAdmin();
  const depositId = Number(formData.get("depositId"));
  if (!depositId) return;
  await prisma.depositLog.updateMany({
    where: { id: depositId, matched: false },
    data: { matched: true },
  });
  revalidatePath("/admin");
  revalidatePath("/admin/charges");
}

/**
 * 입금로그 삭제(관리자). 잘못 들어온/불필요한 미매칭 입금 정리용.
 * 실제 주문에 연결(matchedOrderId)된 건은 지급 이력이라 실수 방지로 삭제하지 않는다.
 */
export async function deleteDeposit(formData: FormData) {
  await requireAdmin();
  const depositId = Number(formData.get("depositId"));
  if (!depositId) return;
  await prisma.depositLog.deleteMany({
    where: { id: depositId, matchedOrderId: null },
  });
  revalidatePath("/admin");
  revalidatePath("/admin/charges");
}

export async function cancelCharge(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const order = await prisma.chargeOrder.findUnique({ where: { id } });
  if (order && !order.charged) {
    await prisma.chargeOrder.update({
      where: { id },
      data: { status: "CANCELED" },
    });
  }
  revalidatePath("/admin");
  revalidatePath("/admin/charges");
  revalidatePath("/admin/inquiries");
}

/**
 * 카드 충전 환불(관리자 충전내역의 환불 버튼): 입력한 포인트만큼(없으면 최대치) 회수 → 결제사 전액/부분 취소.
 * 최대치는 미환불 충전분과 회원 보유 포인트 중 작은 쪽. 처리 내용은 lib/card-refund.ts.
 */
export async function refundCardCharge(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const want = Number(formData.get("point")) || undefined; // 관리자가 입력한 환불 포인트(없으면 최대치)
  if (!Number.isInteger(id)) redirect("/admin/charges?status=COMPLETED&refund=invalid");

  const r = await refundCardOrder(id, { want });
  if (!r.ok) redirect(`/admin/charges?status=COMPLETED&refund=${r.error}`);

  const order = await prisma.chargeOrder.findUnique({ where: { id }, select: { userId: true } });
  revalidatePath("/admin");
  revalidatePath("/admin/charges");
  revalidatePath("/admin/sales");
  if (order) revalidatePath(`/admin/members/${order.userId}`);
  redirect(
    r.full
      ? "/admin/charges?status=CANCELED&refund=ok"
      : `/admin/charges?status=COMPLETED&refund=partial&rp=${r.point}&ra=${r.amount}`,
  );
}

/** 결제사 응답이 불명확했던 카드 환불 정리: canceled=1 이면 취소 확인(표시 삭제), 0 이면 포인트·기록 원복 */
export async function resolveCardRefund(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const canceled = formData.get("canceled") === "1";
  if (!Number.isInteger(id)) return;
  await resolvePendingRefund(id, canceled);
  revalidatePath("/admin");
  revalidatePath("/admin/charges");
  revalidatePath("/admin/sales");
}

/** 취소된 신청을 입금대기로 되돌림 (실수 취소 복구). 이미 지급된 건은 제외. */
export async function restoreCharge(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const order = await prisma.chargeOrder.findUnique({ where: { id } });
  // 카드 충전 건은 결제 승인이 이미 취소된 것이라 되살리면 결제 없이 지급 대상이 된다 → 무통장만
  if (order && !order.charged && order.status === "CANCELED" && order.method === "BANK_TRANSFER") {
    await prisma.chargeOrder.update({
      where: { id },
      data: { status: "PENDING" },
    });
  }
  revalidatePath("/admin");
  revalidatePath("/admin/charges");
  revalidatePath("/admin/inquiries");
}

/** 1:1 문의 삭제 (스팸 등) — 답변(자식)도 함께 삭제 */
export async function deleteInquiry(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  await prisma.inquiry.deleteMany({ where: { parentId: id } });
  await prisma.inquiry.delete({ where: { id } }).catch(() => {});
  revalidatePath("/admin");
  revalidatePath("/admin/inquiries");
}

/** 문의 보관(숨김): 관리자 목록에서만 숨김 — 사용자 기록은 유지 */
export async function hideInquiry(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  await prisma.inquiry.update({ where: { id }, data: { hidden: true } });
  revalidatePath("/admin");
  revalidatePath("/admin/inquiries");
}

/** 보관 해제(복원) */
export async function unhideInquiry(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  await prisma.inquiry.update({ where: { id }, data: { hidden: false } });
  revalidatePath("/admin/inquiries");
}

/** 1:1 문의 답변 */
export async function answerInquiry(formData: FormData) {
  await requireAdmin();
  const parentId = Number(formData.get("parentId"));
  const content = String(formData.get("content") || "").trim();
  if (!content) return;

  const parent = await prisma.inquiry.findUnique({ where: { id: parentId } });
  if (!parent) return;

  await prisma.$transaction([
    prisma.inquiry.create({
      data: {
        parentId,
        title: `RE: ${parent.title}`,
        content,
        status: "ANSWERED",
        name: "관리자",
      },
    }),
    prisma.inquiry.update({
      where: { id: parentId },
      data: { status: "ANSWERED" },
    }),
  ]);

  revalidatePath("/admin");
  revalidatePath("/admin/charges");
  revalidatePath("/admin/inquiries");
}

/** 1:1 문의 답변 수정 */
export async function updateReply(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const content = String(formData.get("content") || "").trim();
  if (!id || !content) return;
  await prisma.inquiry.update({ where: { id }, data: { content } });
  revalidatePath("/admin/inquiries");
}

/** 답변 템플릿(자주 쓰는 답변) 등록 */
export async function createReplyTemplate(formData: FormData) {
  await requireAdmin();
  const title = String(formData.get("title") || "").trim();
  const content = String(formData.get("content") || "").trim();
  if (!title || !content) return;
  await prisma.replyTemplate.create({ data: { title, content } });
  revalidatePath("/admin/inquiries");
}

/** 답변 템플릿 수정 — 삭제 후 재등록하면 순서(order)가 맨 뒤로 밀리므로 제자리에서 고친다 */
export async function updateReplyTemplate(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const title = String(formData.get("title") || "").trim();
  const content = String(formData.get("content") || "").trim();
  if (!id || !title || !content) return;
  await prisma.replyTemplate.update({ where: { id }, data: { title, content } }).catch(() => {});
  revalidatePath("/admin/inquiries");
}

/** 답변 템플릿 삭제 */
export async function deleteReplyTemplate(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  if (!id) return;
  await prisma.replyTemplate.delete({ where: { id } }).catch(() => {});
  revalidatePath("/admin/inquiries");
}

/**
 * 환불 승인 → 신청 포인트 차감. 카드로 충전한 포인트는 카드 결제를 바로 취소하고(최근 충전부터),
 * 카드로 못 채운 나머지만 계좌 송금 대상으로 차감한다(실제 송금은 관리자가 별도로).
 * 멱등: 처리표시를 먼저 선점해 중복 승인을 막는다.
 */
export async function approveRefund(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const inq = await prisma.inquiry.findUnique({ where: { id } });
  if (
    !inq ||
    inq.category !== "REFUND" ||
    inq.refundedAt ||
    !inq.userId ||
    !inq.refundPoint ||
    inq.refundPoint <= 0
  ) {
    redirect("/admin/inquiries?error=refund_invalid");
  }
  const userId = inq.userId;
  const total = inq.refundPoint;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { point: true } });
  if (!user || user.point < total) redirect("/admin/inquiries?error=insufficient");
  // 문자 대기 중 번호가 있으면 그 번호의 예약 포인트까지 환불돼 무료 수신이 된다 → 끝난 뒤 승인
  if (await hasPendingRental(userId)) redirect("/admin/inquiries?error=rental");

  // 처리표시 선점(동시/중복 승인 방지). 이미 처리됐으면 중단.
  const claim = await prisma.inquiry.updateMany({
    where: { id, category: "REFUND", refundedAt: null },
    data: { refundedAt: new Date(), status: "ANSWERED" },
  });
  if (claim.count === 0) redirect("/admin/inquiries?error=refund_invalid");

  // 카드 충전분 / 계좌 송금분을 먼저 나눈다. 카드 취소가 실패한 몫을 계좌로 돌리면 카드 결제가 현금으로
  // 빠져나가는 통로(카드깡)가 되므로, 실패분은 처리하지 않고 회원 포인트에 남긴다.
  const split = await refundSplit(userId, total);

  // 1) 카드 충전분: 결제사 취소(최근 충전부터)
  let cardLeft = split.cardPoint;
  let cardWon = 0;
  let cardFailPoint = 0; // 결제사 거절 → 포인트 원복됨(회원에게 남음)
  let unknown = 0; // 결제사 응답 불명 → 확인 필요로 표시됨
  for (const o of await refundableCardOrders(userId)) {
    if (cardLeft <= 0) break;
    const r = await refundCardOrder(o.id, {
      want: cardLeft,
      log: (p) => ({
        reason: `카드취소 환불 ${p.amount.toLocaleString("ko-KR")}원 (충전 #${o.id})`,
        relType: REFUND_CARD,
        relId: id,
      }),
    });
    if (r.ok || r.error === "pg_unknown") {
      cardLeft -= r.point;
      cardWon += r.amount;
      if (!r.ok) unknown++;
    } else if (r.error === "pg_fail") {
      cardLeft -= r.point;
      cardFailPoint += r.point;
    }
  }
  cardFailPoint += Math.max(0, cardLeft); // 그 사이 사라진 카드 건 등으로 못 채운 몫도 처리하지 않음

  // 2) 계좌 송금분: 포인트만 차감(실제 송금은 관리자가 별도로)
  const left = split.bankPoint;
  let bankFail = false;
  if (left > 0) {
    try {
      await adjustPoint({
        userId,
        amount: -left,
        reason: `포인트 환불 — 계좌 입금 ${chargeAmount(left).toLocaleString("ko-KR")}원`,
        relType: REFUND_POINT,
        relId: id,
      });
    } catch (e) {
      if (!(e instanceof InsufficientPointError)) throw e;
      bankFail = true; // 처리 중 회원이 포인트를 썼다 — 카드분은 이미 처리됐으므로 선점은 유지
    }
  }

  revalidatePath("/admin/inquiries");
  revalidatePath("/admin/charges");
  revalidatePath(`/admin/members/${userId}`);
  redirect(
    `/admin/inquiries?ok=refund&card=${cardWon}&bank=${left > 0 && !bankFail ? chargeAmount(left) : 0}` +
      (cardFailPoint ? `&cardFail=${cardFailPoint}` : "") +
      (unknown ? `&unknown=${unknown}` : "") +
      (bankFail ? `&bankFail=${left}` : ""),
  );
}
