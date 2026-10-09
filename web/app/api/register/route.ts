import { NextResponse, type NextRequest } from "next/server";
import { registerUser, RegisterError } from "@/lib/auth-service";
import { signSession, touchLastSeen, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { verifyTurnstile } from "@/lib/turnstile";
import { isHoneypotHit } from "@/lib/honeypot";
import { checkCode, clearCode, emailProblem, emailVerifyEnabled } from "@/lib/email-verify";
import { logBlock } from "@/lib/block-log";
import { SIGNUP_SRC_COOKIE, decodeFirstVisit } from "@/lib/signup-source";

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

export async function POST(req: NextRequest) {
  // 가입 스팸 제한: IP당 10분에 5회
  if (!(await rateLimit(`register:${clientIp(req)}`, 5, 10 * 60 * 1000))) {
    await logBlock({ kind: "SIGNUP", reason: "RATE_LIMIT", detail: "IP당 10분 5회 초과" });
    return redirectTo(
      `/register?error=${encodeURIComponent("가입 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.")}`,
    );
  }
  const form = await req.formData();
  // 봇 함정 칸이 채워졌으면 가입시키지 않는다(사유는 알려주지 않음)
  if (isHoneypotHit(form)) {
    console.warn(`[register] honeypot hit ip=${clientIp(req)} loginId=${String(form.get("loginId") || "")}`);
    await logBlock({
      kind: "SIGNUP",
      reason: "HONEYPOT",
      detail: "숨김 칸이 채워진 가입 요청(자동화 도구 추정)",
      loginId: String(form.get("loginId") || ""),
      email: String(form.get("email") || ""),
    });
    return redirectTo(`/register?error=${encodeURIComponent("가입 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.")}`);
  }
  const input = {
    loginId: String(form.get("loginId") || ""),
    password: String(form.get("password") || ""),
    name: String(form.get("name") || ""),
    email: String(form.get("email") || ""),
  };
  // 어떻게 알고 왔는지(선택 입력)
  const referral = String(form.get("referral") || "").trim().slice(0, 50);
  const passwordConfirm = String(form.get("passwordConfirm") || "");
  const agree = form.get("agree") === "on";

  // 비밀번호 외 입력값 보존
  const keep = new URLSearchParams({
    loginId: input.loginId,
    name: input.name,
    email: input.email,
    ...(referral ? { referral } : {}),
  }).toString();
  const back = (msg: string) =>
    redirectTo(`/register?error=${encodeURIComponent(msg)}&${keep}`);

  if (input.password !== passwordConfirm) return back("비밀번호가 일치하지 않습니다.");
  if (!agree) return back("이용약관 및 개인정보처리방침에 동의해주세요.");
  const who = { loginId: input.loginId, email: input.email };
  if (!(await verifyTurnstile(form, clientIp(req)))) {
    await logBlock({ kind: "SIGNUP", reason: "CAPTCHA", ...who });
    return back("보안문자 확인에 실패했습니다. 다시 시도해주세요.");
  }
  const badEmail = emailProblem(input.email);
  if (badEmail) {
    await logBlock({
      kind: "SIGNUP",
      reason: "BLOCKED_EMAIL",
      detail: `도메인 ${input.email.split("@")[1] || "?"} — ${badEmail}`,
      ...who,
    });
    return back(badEmail);
  }
  // 이메일 인증번호 확인(발송 수단 미설정이면 건너뜀)
  if (emailVerifyEnabled() && !checkCode(input.email, String(form.get("emailCode") || ""))) {
    await logBlock({ kind: "SIGNUP", reason: "BAD_CODE", detail: "이메일 인증번호 불일치/만료", ...who });
    return back("이메일 인증번호가 올바르지 않거나 만료되었습니다. 인증번호를 다시 받아주세요.");
  }

  let userId: number;
  let role = "USER";
  try {
    // 처음 들어온 경로(proxy 가 남긴 쿠키) + 직접 적은 답 → 관리자만 보는 가입 경로
    const firstVisit = decodeFirstVisit(req.cookies.get(SIGNUP_SRC_COOKIE)?.value);
    const signupSource = { ...(firstVisit ?? {}), ...(referral ? { answer: referral } : {}) };
    const user = await registerUser({
      ...input,
      signupSource: Object.keys(signupSource).length ? signupSource : undefined,
    });
    userId = user.id;
    role = user.role;
    clearCode(input.email);
  } catch (e) {
    if (e instanceof RegisterError) return back(e.message);
    throw e;
  }

  // 가입=첫 접속. 로그인 폼을 거치지 않으므로 여기서 마지막 접속시각을 기록
  // (안 하면 가입 직후 바로 발급한 회원이 로그인 현황에 안 잡힘)
  const ip = clientIp(req);
  await touchLastSeen(userId, ip);

  const token = await signSession(userId, role);
  return setCookieAndGo(token, "/dashboard");
}
