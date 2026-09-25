import { NextResponse } from "next/server";
import { authenticate } from "@/lib/auth-service";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { mailerConfigured, notifySecurity, sendMail } from "@/lib/notify";
import { finishLogin, kst } from "@/lib/login-finish";
import { verifyTurnstile } from "@/lib/turnstile";
import { clearFails, lockedMinutes, recordFail, startAdminChallenge } from "@/lib/login-guard";

// 에러는 303 리다이렉트(쿠키 불필요)
function redirectTo(path: string) {
  return new NextResponse(null, { status: 303, headers: { Location: path } });
}

export async function POST(req: Request) {
  // 무차별 로그인 시도 제한: IP당 5분에 10회
  if (!rateLimit(`login:${clientIp(req)}`, 10, 5 * 60 * 1000)) {
    return redirectTo("/login?error=rate");
  }
  const form = await req.formData();
  const loginId = String(form.get("loginId") || "").trim();
  const password = String(form.get("password") || "");

  const keep = `&id=${encodeURIComponent(loginId)}`;
  if (!loginId || !password) return redirectTo(`/login?error=empty${keep}`);

  if (!(await verifyTurnstile(form, clientIp(req)))) {
    return redirectTo(`/login?error=captcha${keep}`);
  }

  // 계정 잠금(같은 아이디 5회 실패 → 15분). 잠긴 동안은 비밀번호를 확인하지 않는다.
  const locked = lockedMinutes(loginId);
  if (locked) return redirectTo(`/login?error=locked&m=${locked}${keep}`);

  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim();
  const ua = (req.headers.get("user-agent") || "").slice(0, 200);

  const user = await authenticate(loginId, password);
  if (!user) {
    const nowLocked = recordFail(loginId);
    // 관리자 아이디로 로그인 실패 → 보안 알림 (메일 폭탄 방지: 10분에 1통)
    const target = await prisma.user
      .findUnique({ where: { loginId }, select: { role: true } })
      .catch(() => null);
    if (target?.role === "ADMIN" && rateLimit(`admin-fail-mail:${loginId}`, 1, 10 * 60 * 1000)) {
      await notifySecurity(
        `관리자 계정 로그인 실패 (${loginId})`,
        `관리자 아이디로 로그인 실패가 발생했습니다.

아이디: ${loginId}
IP: ${ip || "알 수 없음"}
시각: ${kst(new Date())}
브라우저: ${ua}

본인이 아니라면 비밀번호를 변경하세요. (10분 내 추가 실패는 따로 알리지 않습니다)`,
      );
    }
    if (nowLocked) return redirectTo(`/login?error=locked&m=15${keep}`);
    return redirectTo(`/login?error=invalid${keep}`);
  }
  clearFails(loginId);

  // 관리자 2단계: 비밀번호 통과 후 이메일 인증번호를 한 번 더 확인(/login/verify).
  // 발송 수단이 없으면 관리자가 잠겨버리지 않도록 건너뛴다.
  if (user.role === "ADMIN" && mailerConfigured()) {
    // 보안 알림을 받는 관리자 주소 우선(평소 확인하는 메일함), 없으면 계정 이메일
    const to = process.env.ADMIN_EMAIL || user.email || "";
    if (to) {
      const { id, code } = startAdminChallenge(user.id);
      try {
        await sendMail(
          to,
          "관리자 로그인 인증번호",
          `관리자 로그인 인증번호는 ${code} 입니다. (5분간 유효)

IP: ${ip || "알 수 없음"}
시각: ${kst(new Date())}
브라우저: ${ua}

본인이 로그인한 것이 아니라면 비밀번호가 유출된 것입니다. 즉시 비밀번호를 변경하세요.`,
        );
      } catch (e) {
        console.error("[login] admin 2fa mail failed:", e);
        return redirectTo(`/login?error=mail${keep}`);
      }
      return redirectTo(`/login/verify?c=${id}`);
    }
  }

  return finishLogin(user, ip, ua);
}
