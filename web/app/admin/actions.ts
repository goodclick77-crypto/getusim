"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { adjustPoint } from "@/lib/points";

/** 입금확인 → 포인트 지급 (멱등) */
export async function confirmCharge(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));

  await prisma.$transaction(async (tx) => {
    const order = await tx.chargeOrder.findUnique({ where: { id } });
    if (!order || order.charged || order.status === "CANCELED") return;

    await tx.chargeOrder.update({
      where: { id },
      data: {
        status: "COMPLETED",
        charged: true,
        paidPrice: order.amount,
        paidAt: new Date(),
      },
    });
    await adjustPoint(
      {
        userId: order.userId,
        amount: order.chargePoint,
        reason: "포인트 충전",
        relType: "charge",
        relId: order.id,
      },
      tx,
    );
  });

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
