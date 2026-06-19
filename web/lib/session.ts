import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "./prisma";

export const SESSION_COOKIE = "getusim_session";
const COOKIE = SESSION_COOKIE;
const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET || "dev-secret-change-in-production",
);

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

async function readPayload(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
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

/** 로그인 필수. 미로그인 시 throw (라우트에서 redirect 처리). */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") throw new Error("FORBIDDEN");
  return user;
}
