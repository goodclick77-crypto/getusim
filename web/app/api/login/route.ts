import { NextResponse } from "next/server";
import { authenticate } from "@/lib/auth-service";
import { signSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";

// 일반 폼 POST 로그인 — 쿠키를 응답에 직접 세팅(가장 안정적).
function redirectTo(path: string) {
  return new NextResponse(null, { status: 303, headers: { Location: path } });
}

export async function POST(req: Request) {
  const form = await req.formData();
  const loginId = String(form.get("loginId") || "").trim();
  const password = String(form.get("password") || "");

  if (!loginId || !password) return redirectTo("/login?error=empty");

  const user = await authenticate(loginId, password);
  if (!user) return redirectTo("/login?error=invalid");

  const token = await signSession(user.id, user.role);
  const res = redirectTo("/dashboard");
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}
