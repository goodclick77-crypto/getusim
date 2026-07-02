import { NextResponse } from "next/server";
import { registerUser, RegisterError } from "@/lib/auth-service";
import { signSession, touchLastSeen, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";
import { rateLimit, clientIp } from "@/lib/ratelimit";

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
  // 가입 스팸 제한: IP당 10분에 5회
  if (!rateLimit(`register:${clientIp(req)}`, 5, 10 * 60 * 1000)) {
    return redirectTo(
      `/register?error=${encodeURIComponent("가입 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.")}`,
    );
  }
  const form = await req.formData();
  const input = {
    loginId: String(form.get("loginId") || ""),
    password: String(form.get("password") || ""),
    name: String(form.get("name") || ""),
    email: String(form.get("email") || ""),
  };
  const passwordConfirm = String(form.get("passwordConfirm") || "");
  const agree = form.get("agree") === "on";

  // 비밀번호 외 입력값 보존
  const keep = new URLSearchParams({
    loginId: input.loginId,
    name: input.name,
    email: input.email,
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

  // 가입=첫 접속. 로그인 폼을 거치지 않으므로 여기서 마지막 접속시각을 기록
  // (안 하면 가입 직후 바로 발급한 회원이 로그인 현황에 안 잡힘)
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim();
  await touchLastSeen(userId, ip);

  const token = await signSession(userId, role);
  return setCookieAndGo(token, "/dashboard");
}
