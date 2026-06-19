import { NextResponse } from "next/server";
import { registerUser, RegisterError } from "@/lib/auth-service";
import { signSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";

function redirectTo(path: string) {
  return new NextResponse(null, { status: 303, headers: { Location: path } });
}

function setCookieAndGo(token: string, path: string) {
  const res = new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${path}"></head><body style="font-family:sans-serif;padding:2rem">처리 중…<script>location.replace(${JSON.stringify(path)})</script></body></html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
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
  return setCookieAndGo(token, "/dashboard");
}
