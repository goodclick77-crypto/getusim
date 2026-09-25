import "server-only";
import { randomBytes } from "crypto";
import { checkCode, clearCode, issueCode } from "./email-verify";

// 로그인 보호(인메모리 — ratelimit.ts와 같은 단일 인스턴스 가정, 재배포 시 초기화).
//   · 계정 잠금: 같은 아이디로 5회 실패 → 15분 잠금(IP가 바뀌어도 적용). 성공 시 초기화.
//   · 관리자 2단계: 비밀번호 통과 후 이메일 인증번호(5분 유효, 5회 오입력 폐기).

const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;

type Fail = { count: number; lockedUntil: number };
const fails = new Map<string, Fail>();

/** 잠겨 있으면 남은 분(올림), 아니면 0 */
export function lockedMinutes(loginId: string): number {
  const f = fails.get(loginId);
  if (!f || f.lockedUntil <= Date.now()) return 0;
  return Math.ceil((f.lockedUntil - Date.now()) / 60000);
}

/** 실패 기록. 이번 실패로 잠기면 true */
export function recordFail(loginId: string): boolean {
  const now = Date.now();
  let f = fails.get(loginId);
  if (!f || (f.lockedUntil && f.lockedUntil <= now)) f = { count: 0, lockedUntil: 0 };
  f.count += 1;
  if (f.count >= MAX_FAILS) {
    f.lockedUntil = now + LOCK_MS;
    f.count = 0;
  }
  fails.set(loginId, f);
  if (fails.size > 10000) {
    for (const [k, v] of fails) if (v.lockedUntil <= now && v.count === 0) fails.delete(k);
  }
  return f.lockedUntil > now;
}

export function clearFails(loginId: string) {
  fails.delete(loginId);
}

// ── 관리자 2단계 인증 ──
const CHALLENGE_MS = 5 * 60 * 1000;
const challenges = new Map<string, { userId: number; exp: number }>();

/** 대기 중인 인증 ID와 인증번호를 만든다 */
export function startAdminChallenge(userId: number): { id: string; code: string } {
  const now = Date.now();
  for (const [k, v] of challenges) if (v.exp < now) challenges.delete(k);
  const id = randomBytes(16).toString("hex");
  challenges.set(id, { userId, exp: now + CHALLENGE_MS });
  return { id, code: issueCode(`admin2fa:${id}`, CHALLENGE_MS) };
}

/** 인증번호가 맞으면 userId, 아니면 null(오입력 5회면 인증 자체가 폐기됨) */
export function finishAdminChallenge(id: string, code: string): number | null {
  const c = challenges.get(id);
  if (!c || c.exp < Date.now()) {
    challenges.delete(id);
    return null;
  }
  if (!checkCode(`admin2fa:${id}`, code)) return null;
  challenges.delete(id);
  clearCode(`admin2fa:${id}`);
  return c.userId;
}

export function adminChallengeAlive(id: string): boolean {
  const c = challenges.get(id);
  return !!c && c.exp >= Date.now();
}
