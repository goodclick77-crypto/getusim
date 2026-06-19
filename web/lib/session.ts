import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "./prisma";

const COOKIE = "getusim_session";
const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET || "dev-secret-change-in-production",
);

export type SessionPayload = { uid: number; role: string };

export async function createSession(uid: number, role: string) {
  const token = await new SignJWT({ uid, role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);

  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
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
