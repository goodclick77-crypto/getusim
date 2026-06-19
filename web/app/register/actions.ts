"use server";

import { redirect } from "next/navigation";
import { registerUser, RegisterError } from "@/lib/auth-service";
import { createSession } from "@/lib/session";

export async function registerAction(formData: FormData) {
  const input = {
    loginId: String(formData.get("loginId") || ""),
    password: String(formData.get("password") || ""),
    name: String(formData.get("name") || ""),
    email: String(formData.get("email") || ""),
    phone: String(formData.get("phone") || ""),
  };

  let userId: number;
  try {
    const user = await registerUser(input);
    userId = user.id;
  } catch (e) {
    if (e instanceof RegisterError) {
      redirect(`/register?error=${encodeURIComponent(e.message)}`);
    }
    throw e;
  }

  await createSession(userId, "USER");
  redirect("/dashboard");
}
