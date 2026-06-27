"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 내 정보 수정: 이메일/이름/휴대폰 (아이디는 변경 불가) */
export async function updateProfile(formData: FormData) {
  const user = await requireUser();
  const email = String(formData.get("email") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const phone = String(formData.get("phone") || "").replace(/[^\d]/g, "");

  // 이메일은 아이디/비밀번호 복구 채널이라 형식 검증 필수
  if (!email || !EMAIL_RE.test(email)) {
    redirect("/account?error=email");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { email, name, phone },
  });

  revalidatePath("/account");
  redirect("/account?ok=1");
}
