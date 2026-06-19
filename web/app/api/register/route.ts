import { NextResponse } from "next/server";
import { registerUser, RegisterError } from "@/lib/auth-service";
import { signSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";

function redirectTo(path: string) {
  return new NextResponse(null, { status: 303, headers: { Location: path } });
}

export async function POST(req: Request) {
  const form = await req.formData();
  const input = {
    loginId: String(form.get("loginId") || ""),
    password: String(form.get("password") || ""),
    name: String(form.get("name") || ""),
    email: String(form.get("email") || ""),
    phone: String(form.get("phone") || ""),
  };

  let userId: number;
  let role = "USER";
  try {
    const user = await registerUser(input);
    userId = user.id;
    role = user.role;
  } catch (e) {
    if (e instanceof RegisterError) {
      return redirectTo(`/register?error=${encodeURIComponent(e.message)}`);
    }
    throw e;
  }

  const token = await signSession(userId, role);
  const res = redirectTo("/dashboard");
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}
