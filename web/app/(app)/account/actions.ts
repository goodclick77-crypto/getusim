"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser, destroySession } from "@/lib/session";
import { authenticate } from "@/lib/auth-service";
import { adjustPoint } from "@/lib/points";
import { prisma } from "@/lib/prisma";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 내 정보 수정: 이메일/이름/휴대폰 (아이디는 변경 불가) */
export async function updateProfile(formData: FormData) {
  const user = await requireUser();
  const email = String(formData.get("email") || "").trim();
  const name = String(formData.get("name") || "").trim();

  // 이메일은 아이디/비밀번호 복구 채널이라 형식 검증 필수
  if (!email || !EMAIL_RE.test(email)) {
    redirect("/account?error=email");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { email, name },
  });

  revalidatePath("/account");
  redirect("/account?ok=1");
}

/**
 * 회원 탈퇴(본인). 소프트 탈퇴: leftAt 기록 → 로그인/인증 즉시 차단.
 * - 비밀번호 재확인(본인 확인)
 * - 진행 중(수신대기) 번호가 있으면 보류(예약 포인트/원가 손실 방지)
 * - 잔여 포인트가 있으면 '소멸 동의' 필수 → 동의 시 포인트 원장 차감(소멸) 후 탈퇴
 */
export async function withdrawAccount(formData: FormData) {
  const user = await requireUser();
  // 관리자 계정은 자가 탈퇴 불가(잠금 방지)
  if (user.role === "ADMIN") redirect("/account");

  const password = String(formData.get("password") || "");
  const agreePointLoss = formData.get("agreePointLoss") === "on";

  // 본인 확인 — 비밀번호 재검증
  if (!password || !(await authenticate(user.loginId, password))) {
    redirect("/account?error=pw");
  }

  // 진행 중(수신대기) 번호가 있으면 탈퇴 보류
  const active = await prisma.numberRental.count({
    where: { userId: user.id, status: "PENDING", expiresAt: { gt: new Date() } },
  });
  if (active > 0) redirect("/account?error=active");

  // 잔여 포인트가 있으면 소멸 동의 필수
  if (user.point > 0 && !agreePointLoss) {
    redirect("/account?error=agree");
  }

  // 포인트 소멸(원장 기록) + 소프트 탈퇴를 한 트랜잭션으로
  await prisma.$transaction(async (tx) => {
    const fresh = await tx.user.findUnique({
      where: { id: user.id },
      select: { point: true, leftAt: true },
    });
    if (!fresh || fresh.leftAt) return; // 이미 탈퇴/차단된 계정
    if (fresh.point > 0) {
      await adjustPoint(
        {
          userId: user.id,
          amount: -fresh.point,
          reason: "회원 탈퇴 · 잔여 포인트 소멸",
          relType: "withdraw",
        },
        tx,
      );
    }
    await tx.user.update({ where: { id: user.id }, data: { leftAt: new Date() } });
  });

  await destroySession();
  redirect("/?left=1");
}
