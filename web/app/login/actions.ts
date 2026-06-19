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
  redirect(user.role === "ADMIN" ? "/admin" : "/dashboard");
}
