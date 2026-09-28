"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { adjustPoint, InsufficientPointError } from "@/lib/points";
import { logBlock } from "@/lib/block-log";

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

/** 관리자 메모 저장 (관리자 화면에서만 보임) */
export async function saveMemo(formData: FormData) {
  await requireAdmin();
  const userId = Number(formData.get("userId"));
  if (!userId) redirect("/admin/members");
  const memo = String(formData.get("memo") || "").trim().slice(0, 5000);
  await prisma.user.update({ where: { id: userId }, data: { memo: memo || null } });
  revalidatePath(`/admin/members/${userId}`);
  redirect(`/admin/members/${userId}?ok=memo`);
}

/** 이용정지(탈퇴처리) / 해제 토글 */
export async function toggleBlock(formData: FormData) {
  const admin = await requireAdmin();
  const userId = Number(formData.get("userId"));
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { leftAt: true, loginId: true, email: true, memo: true, lastLoginIp: true },
  });
  if (!u) redirect("/admin/members");
  await prisma.user.update({
    where: { id: userId },
    data: { leftAt: u.leftAt ? null : new Date() },
  });
  const memo = (u.memo || "").trim().split("\n").pop() || "";
  await logBlock({
    kind: "ADMIN",
    reason: u.leftAt ? "UNSUSPEND" : "SUSPEND",
    detail: `처리 관리자: ${admin.loginId}${memo ? ` · 최근 메모: ${memo}` : ""}`,
    loginId: u.loginId,
    email: u.email,
    userId,
    ip: u.lastLoginIp,
  });
  revalidatePath(`/admin/members/${userId}`);
}
