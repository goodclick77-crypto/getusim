import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "./prisma";

export const SESSION_COOKIE = "getusim_session";
const COOKIE = SESSION_COOKIE;

// 운영에서 AUTH_SECRET 미설정이면 공개된 기본값으로 서명되어 세션 위조 위험 → 즉시 중단
if (!process.env.AUTH_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("AUTH_SECRET 환경변수가 설정되지 않았습니다 (운영 필수).");
}
const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET || "dev-secret-change-in-production",
);
const JWT_ALG = { algorithms: ["HS256"] };

export type SessionPayload = { uid: number; role: string };

const MAX_AGE = 60 * 60 * 24 * 30; // 30일

/** 세션 쿠키 옵션 (Route Handler에서 response.cookies.set 에 사용) */
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: MAX_AGE,
    path: "/",
  };
}

/** 비밀번호 재설정 토큰 (본인확인 통과 후 15분) */
export async function signResetToken(uid: number) {
  return new SignJWT({ uid, purpose: "reset" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(secret);
}
export async function verifyResetToken(token: string): Promise<number | null> {
  try {
    const { payload } = await jwtVerify(token, secret, JWT_ALG);
    if (payload.purpose !== "reset") return null;
    return Number(payload.uid);
  } catch {
    return null;
  }
}

/** 세션 JWT 발급 */
export async function signSession(uid: number, role: string) {
  return new SignJWT({ uid, role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);
}

/** 서버 액션/컴포넌트에서 쿠키 직접 세팅 */
export async function createSession(uid: number, role: string) {
  const token = await signSession(uid, role);
  const store = await cookies();
  store.set(COOKIE, token, sessionCookieOptions());
}

export async function destroySession() {
  const store = await cookies();
  store.delete(COOKIE);
}

// 로그인 폼 제출(/api/login) 외에도, 세션만으로 활동(번호 발급 등)하는 사용자가
// 로그인 현황(lastLoginAt 기준)에 잡히도록 "마지막 접속시각"을 갱신한다.
// 매 요청마다 쓰면 부담이라, 마지막 기록이 THROTTLE 이상 지난 경우에만 1회 UPDATE.
const LAST_SEEN_THROTTLE_MS = 10 * 60 * 1000; // 10분
export async function touchLastSeen(userId: number, ip?: string) {
  const cutoff = new Date(Date.now() - LAST_SEEN_THROTTLE_MS);
  await prisma.user
    .updateMany({
      // null(가입 후 미로그인 등)이거나 마지막 접속이 THROTTLE 이전인 경우만 갱신
      where: { id: userId, OR: [{ lastLoginAt: null }, { lastLoginAt: { lt: cutoff } }] },
      data: { lastLoginAt: new Date(), ...(ip ? { lastLoginIp: ip } : {}) },
    })
    .catch(() => {});
}

async function readPayload(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret, JWT_ALG);
    return { uid: Number(payload.uid), role: String(payload.role) };
  } catch {
    return null;
  }
}

/** 현재 로그인 사용자(없으면 null). DB 최신 상태 반영. */
export async function getCurrentUser() {
  const p = await readPayload();
  if (!p) return null;
  const user = await prisma.user.findUnique({ where: { id: p.uid } });
  if (!user || user.leftAt) return null;
  return user;
}

/** 로그인 필수. 미로그인 시 /login 으로 redirect (throw 아님 → 500 방지). */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/dashboard");
  return user;
}
