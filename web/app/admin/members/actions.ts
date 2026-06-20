"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { adjustPoint, InsufficientPointError } from "@/lib/points";

/** 관리자 수동 포인트 지급/차감 (양수=지급, 음수=차감) */
export async function adjustMemberPoint(formData: FormData) {
  await requireAdmin();
  const userId = Number(formData.get("userId"));
  const amount = Number(formData.get("amount"));
  const reason = String(formData.get("reason") || "").trim();

  if (!userId || !amount || isNaN(amount)) {
    redirect(`/admin/members/${userId}?error=invalid`);
  }
  try {
    await adjustPoint({
      userId,
      amount,
      reason: reason ? `[관리자] ${reason}` : "[관리자] 수동 조정",
      relType: "admin",
    });
  } catch (e) {
    if (e instanceof InsufficientPointError) {
      redirect(`/admin/members/${userId}?error=insufficient`);
    }
    throw e;
  }
  revalidatePath(`/admin/members/${userId}`);
  redirect(`/admin/members/${userId}?ok=1`);
}

/** 이용정지(탈퇴처리) / 해제 토글 */
export async function toggleBlock(formData: FormData) {
  await requireAdmin();
  const userId = Number(formData.get("userId"));
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { leftAt: true },
  });
  await prisma.user.update({
    where: { id: userId },
    data: { leftAt: u?.leftAt ? null : new Date() },
  });
  revalidatePath(`/admin/members/${userId}`);
}
