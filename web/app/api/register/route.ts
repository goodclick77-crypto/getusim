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
  const passwordConfirm = String(form.get("passwordConfirm") || "");
  const agree = form.get("agree") === "on";

  // 비밀번호 외 입력값 보존
  const keep = new URLSearchParams({
    loginId: input.loginId,
    name: input.name,
    email: input.email,
    phone: input.phone,
  }).toString();
  const back = (msg: string) =>
    redirectTo(`/register?error=${encodeURIComponent(msg)}&${keep}`);

  if (input.password !== passwordConfirm) return back("비밀번호가 일치하지 않습니다.");
  if (!agree) return back("이용약관 및 개인정보처리방침에 동의해주세요.");

  let userId: number;
  let role = "USER";
  try {
    const user = await registerUser(input);
    userId = user.id;
    role = user.role;
  } catch (e) {
    if (e instanceof RegisterError) return back(e.message);
    throw e;
  }

  const token = await signSession(userId, role);
  return setCookieAndGo(token, "/dashboard");
}
