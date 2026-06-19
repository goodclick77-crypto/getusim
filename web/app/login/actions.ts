"use server";

import { redirect } from "next/navigation";
import { authenticate } from "@/lib/auth-service";
import { createSession } from "@/lib/session";

export async function loginAction(formData: FormData) {
  const loginId = String(formData.get("loginId") || "").trim();
  const password = String(formData.get("password") || "");

  if (!loginId || !password) redirect("/login?error=empty");

  const user = await authenticate(loginId, password);
  if (!user) redirect("/login?error=invalid");

  await createSession(user.id, user.role);
  // 관리자도 일반 사용자 화면을 기본으로 (번호인증 등 동일하게 이용). 관리 기능은 상단 "관리자" 링크.
  redirect("/dashboard");
}
