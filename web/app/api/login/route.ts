import { NextResponse } from "next/server";
import { authenticate } from "@/lib/auth-service";
import { signSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";

// 에러는 303 리다이렉트(쿠키 불필요)
function redirectTo(path: string) {
  return new NextResponse(null, { status: 303, headers: { Location: path } });
}

// 성공: 쿠키는 반드시 200 응답에 실어 세팅(브라우저가 3xx 응답의 Set-Cookie를
// 저장하지 않는 환경 대응) 후, 페이지에서 이동.
function setCookieAndGo(token: string, path: string) {
  const res = new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${path}"></head><body style="font-family:sans-serif;padding:2rem">로그인 중…<script>location.replace(${JSON.stringify(path)})</script></body></html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}

export async function POST(req: Request) {
  const form = await req.formData();
  const loginId = String(form.get("loginId") || "").trim();
  const password = String(form.get("password") || "");

  if (!loginId || !password) return redirectTo("/login?error=empty");

  const user = await authenticate(loginId, password);
  if (!user) return redirectTo("/login?error=invalid");

  const token = await signSession(user.id, user.role);
  return setCookieAndGo(token, "/dashboard");
}
