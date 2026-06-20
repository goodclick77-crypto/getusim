"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { completeCharge } from "@/lib/charge";

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
