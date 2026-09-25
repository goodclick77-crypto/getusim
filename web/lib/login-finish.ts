import "server-only";
import { NextResponse } from "next/server";
import { prisma } from "./prisma";
import { signSession, SESSION_COOKIE, sessionCookieOptions } from "./session";
import { notifySecurity } from "./notify";

export function kst(d: Date) {
  return d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
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

/** 세션 발급 + 관리자 알림 + 최근 접속 기록 (관리자 2단계 통과 후에도 사용) */
export async function finishLogin(
  user: { id: number; loginId: string; role: string; lastLoginIp: string },
  ip: string,
  ua: string,
) {
  // 관리자 로그인 성공 → 보안 알림 (본인이 아니면 즉시 비밀번호 변경하도록)
  if (user.role === "ADMIN") {
    const sameIp = !!ip && ip === user.lastLoginIp;
    await notifySecurity(
      `관리자 로그인 (${user.loginId})${sameIp ? "" : " — 새 IP"}`,
      `관리자 계정으로 로그인했습니다.

아이디: ${user.loginId}
IP: ${ip || "알 수 없음"}${sameIp ? " (지난 로그인과 같음)" : ` (지난 로그인: ${user.lastLoginIp || "기록 없음"})`}
시각: ${kst(new Date())}
브라우저: ${ua}

본인이 아니라면 즉시 비밀번호를 변경하세요.`,
    );
  }

  // 최근 접속 기록 (실패해도 로그인은 진행)
  await prisma.user
    .update({ where: { id: user.id }, data: { lastLoginAt: new Date(), lastLoginIp: ip } })
    .catch(() => {});

  const token = await signSession(user.id, user.role);
  return setCookieAndGo(token, "/dashboard");
}
