"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { completeCharge } from "@/lib/charge";
import { adjustPoint, InsufficientPointError } from "@/lib/points";

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

/** 취소된 신청을 입금대기로 되돌림 (실수 취소 복구). 이미 지급된 건은 제외. */
export async function restoreCharge(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const order = await prisma.chargeOrder.findUnique({ where: { id } });
  if (order && !order.charged && order.status === "CANCELED") {
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
