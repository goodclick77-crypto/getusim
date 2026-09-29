"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { cardRefundOf, cardRefundPlan, completeCharge, expireStaleChargeOrders } from "@/lib/charge";
import type { Prisma } from "@prisma/client";
import { expireStaleRentals } from "@/lib/rentals";
import { adjustPoint, InsufficientPointError } from "@/lib/points";
import { getPaymentProvider } from "@/lib/payments";

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
 * 카드 충전 환불: 지급했던 포인트 회수 → 결제사 승인취소(전액/부분).
 * 환불 포인트 = 아직 환불 안 된 충전분과 회원 보유 포인트 중 작은 쪽 — 이미 쓴 포인트는 환불하지 않는다.
 * 여러 번 나눠 환불할 수 있고, 누적 환불은 주문 legacyData(refundedPoint/refundedAmount)에 쌓는다.
 * 전부 환불되면 주문을 취소(환불됨) 처리한다.
 * 포인트를 먼저 회수한다 — 취소를 먼저 하고 회수가 실패하면 돈도 돌려주고 포인트도 남는다.
 * 결제사 취소가 실패하면 회수한 포인트와 환불 기록을 되돌린다.
 */
export async function refundCardCharge(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) redirect("/admin/charges?status=COMPLETED&refund=invalid");

  let plan: { point: number; amount: number; full: boolean };
  let order: { userId: number; pgTno: string };
  try {
    ({ plan, order } = await prisma.$transaction(async (tx) => {
      // 같은 주문 동시 환불 방지(행 잠금) 후 최신 상태로 다시 읽는다
      await tx.$queryRaw`SELECT id FROM charge_order WHERE id = ${id} FOR UPDATE`;
      const o = await tx.chargeOrder.findUnique({ where: { id } });
      if (!o || o.method !== "CARD" || o.status !== "COMPLETED" || !o.charged || !o.pgTno) {
        throw new Error("INVALID");
      }
      const u = await tx.user.findUnique({ where: { id: o.userId }, select: { point: true } });
      const p = cardRefundPlan(o, u?.point ?? 0);
      if (p.point <= 0 || p.amount <= 0) throw new InsufficientPointError();

      // 잔액이 그 사이 줄었으면 InsufficientPointError → 트랜잭션 롤백
      await adjustPoint(
        {
          userId: o.userId,
          amount: -p.point,
          reason: p.full ? "카드 충전 환불(결제 취소)" : "카드 충전 부분환불(결제 부분취소)",
          relType: "charge_refund",
          relId: o.id,
        },
        tx,
      );
      const prev = cardRefundOf(o.legacyData);
      await tx.chargeOrder.update({
        where: { id },
        data: {
          ...(p.full ? { status: "CANCELED" as const, charged: false } : {}),
          legacyData: {
            ...((o.legacyData ?? {}) as Record<string, unknown>),
            refundedPoint: prev.point + p.point,
            refundedAmount: prev.amount + p.amount,
            ...(p.full ? { refundedAt: new Date().toISOString() } : {}),
          },
        },
      });
      return { plan: p, order: { userId: o.userId, pgTno: o.pgTno } };
    }));
  } catch (e) {
    if (e instanceof InsufficientPointError) redirect("/admin/charges?status=COMPLETED&refund=insufficient");
    if (e instanceof Error && e.message === "INVALID") redirect("/admin/charges?status=COMPLETED&refund=invalid");
    throw e;
  }

  try {
    await getPaymentProvider().cancel({
      txId: order.pgTno,
      reason: "관리자 환불",
      amount: plan.amount, // 마지막 환불이면 결제액의 나머지 전부
    });
  } catch (e) {
    console.error(`[admin] 카드 충전 환불 — 결제사 취소 실패 order#${id} tx=${order.pgTno} ${plan.amount}원:`, e);
    // 되돌리기: 이번 환불분만큼 기록을 빼고 포인트 재지급, 전액 환불이었으면 완료 상태로 복구
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM charge_order WHERE id = ${id} FOR UPDATE`;
      const o = await tx.chargeOrder.findUnique({ where: { id } });
      if (!o) return;
      const cur = cardRefundOf(o.legacyData);
      const data = { ...((o.legacyData ?? {}) as Record<string, unknown>) };
      data.refundedPoint = Math.max(0, cur.point - plan.point);
      data.refundedAmount = Math.max(0, cur.amount - plan.amount);
      delete data.refundedAt;
      await tx.chargeOrder.update({
        where: { id },
        data: {
          ...(plan.full ? { status: "COMPLETED" as const, charged: true } : {}),
          legacyData: data as Prisma.InputJsonObject,
        },
      });
      await adjustPoint(
        {
          userId: order.userId,
          amount: plan.point,
          reason: "카드 충전 환불 실패로 포인트 복구",
          relType: "charge_refund",
          relId: id,
        },
        tx,
      );
    });
    redirect("/admin/charges?status=COMPLETED&refund=pg_fail");
  }

  revalidatePath("/admin");
  revalidatePath("/admin/charges");
  revalidatePath("/admin/sales");
  revalidatePath(`/admin/members/${order.userId}`);
  redirect(
    plan.full
      ? "/admin/charges?status=CANCELED&refund=ok"
      : `/admin/charges?status=COMPLETED&refund=partial&rp=${plan.point}&ra=${plan.amount}`,
  );
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

/** 환불 승인 → 신청 포인트 자동 차감 (멱등: 이미 처리됐거나 잔액부족이면 변동 없음) */
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
  try {
    await prisma.$transaction(async (tx) => {
      // 먼저 처리표시를 선점(동시/중복 승인 방지). 이미 처리됐으면 count=0 → 중단.
      const claim = await tx.inquiry.updateMany({
        where: { id, category: "REFUND", refundedAt: null },
        data: { refundedAt: new Date(), status: "ANSWERED" },
      });
      if (claim.count === 0) throw new Error("ALREADY");
      // 포인트 차감(잔액부족이면 InsufficientPointError → 트랜잭션 롤백)
      await adjustPoint(
        {
          userId: inq.userId!,
          amount: -inq.refundPoint!,
          reason: "포인트 환불",
          relType: "refund",
          relId: inq.id,
        },
        tx,
      );
    });
  } catch (e) {
    if (e instanceof InsufficientPointError) {
      redirect("/admin/inquiries?error=insufficient");
    }
    if (e instanceof Error && e.message === "ALREADY") {
      redirect("/admin/inquiries?error=refund_invalid");
    }
    throw e;
  }
  revalidatePath("/admin/inquiries");
  revalidatePath(`/admin/members/${inq.userId}`);
  redirect("/admin/inquiries?ok=refund");
}
