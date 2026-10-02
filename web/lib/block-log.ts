import "server-only";
import { headers } from "next/headers";
import { prisma } from "./prisma";
import { rateLimitLocal, ipFromHeaders } from "./ratelimit";

// 보안 차단 기록(관리자 > 차단 내역). 기록 실패가 본 요청을 깨뜨리면 안 되므로 절대 throw 하지 않는다.

export const BLOCK_KIND: Record<string, string> = {
  SIGNUP: "회원가입",
  SEND_CODE: "인증번호 발송",
  LOGIN: "로그인",
  ADMIN_2FA: "관리자 2단계",
  INQUIRY: "1:1 문의",
  CHARGE: "충전 신청",
  FIND_ID: "아이디 찾기",
  FIND_PW: "비밀번호 찾기",
  ADMIN: "관리자 조치",
  ACCOUNT: "입금 계좌",
};

export const BLOCK_REASON: Record<string, string> = {
  BLOCKED_EMAIL: "사용 불가 이메일",
  HONEYPOT: "봇 함정 걸림",
  CAPTCHA: "보안문자 실패",
  RATE_LIMIT: "요청 횟수 초과",
  ACCOUNT_LOCKED: "잠긴 계정 로그인",
  LOCK_TRIGGERED: "로그인 실패로 잠금",
  BAD_CODE: "인증번호 오류",
  SUSPEND: "이용정지",
  UNSUSPEND: "이용정지 해제",
  DELETE: "계정 삭제",
  ACCOUNT_VIEW: "계좌번호 확인", // 차단은 아니지만 통장묶기 대비 추적용 — 차단 내역의 별도 탭에서만 보인다
};

type Entry = {
  kind: keyof typeof BLOCK_KIND;
  reason: keyof typeof BLOCK_REASON;
  detail?: string;
  email?: string;
  loginId?: string;
  userId?: number | null;
  /** 요청 IP 대신 남길 IP(관리자 조치는 관리자 IP가 아니라 대상 회원의 마지막 IP) */
  ip?: string;
};

export async function logBlock(e: Entry): Promise<void> {
  try {
    const h = await headers();
    const ip =
      e.ip ?? ipFromHeaders(h);
    // 도배 방지: 같은 IP·같은 사유·같은 대상은 30초에 1건, 전체는 1시간 2,000건까지만 기록
    const who = e.email || e.loginId || String(e.userId ?? "");
    if (e.kind !== "ADMIN") {
      if (!rateLimitLocal(`blocklog:${e.kind}:${e.reason}:${ip}:${who}`, 1, 30 * 1000)) return;
      if (!rateLimitLocal("blocklog:all", 2000, 60 * 60 * 1000)) return;
    }
    await prisma.blockLog.create({
      data: {
        kind: e.kind,
        reason: e.reason,
        detail: (e.detail || "").slice(0, 1000),
        email: (e.email || "").trim().toLowerCase().slice(0, 200),
        loginId: (e.loginId || "").trim().slice(0, 100),
        userId: e.userId ?? null,
        ip: ip.slice(0, 100),
        userAgent: e.kind === "ADMIN" ? "" : (h.get("user-agent") || "").slice(0, 300),
      },
    });
  } catch (err) {
    console.error("[block-log] write failed:", err);
  }
}
