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
