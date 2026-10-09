import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import {
  SIGNUP_SRC_COOKIE,
  SIGNUP_SRC_MAX_AGE,
  buildFirstVisit,
  encodeFirstVisit,
} from "@/lib/signup-source";

// 임시 점검 모드 게이트 (Next 16: middleware → proxy 로 명칭 변경, Node.js 런타임 기본).
//   · MAINTENANCE_MODE 가 켜져 있으면 비관리자 요청을 /maintenance 로 rewrite(503).
//   · 관리자(role=ADMIN 세션)는 그대로 통과 → 점검 중에도 사이트 정리/운영 가능.
//   · 켜고 끄기: Railway 환경변수 MAINTENANCE_MODE=1 (끄려면 0 또는 변수 삭제).

const SESSION_COOKIE = "getusim_session"; // lib/session.ts 와 동일 (server-only 라 직접 import 불가)

const SESSION_AUD = `getusim:${process.env.RAILWAY_ENVIRONMENT_NAME || "local"}`; // lib/session.ts 와 동일
const secret = process.env.AUTH_SECRET
  ? new TextEncoder().encode(process.env.AUTH_SECRET)
  : null;

// 점검 중에도 접근 허용: 관리자 로그인/로그아웃·비번찾기·점검 페이지 자체
// + 입금 웹훅(자체 토큰 인증 → 점검 중에도 입금 자동처리 유지)
const ALLOW_PREFIXES = [
  "/maintenance",
  "/login",
  "/logout",
  "/find-password",
  "/find-id",
  "/api/login",
  "/api/logout",
  "/api/find-password",
  "/api/find-id",
  "/api/reset-password",
  "/api/payments/deposit-webhook",
  "/opengraph-image", // 카톡 등 링크 미리보기 이미지
];

function maintenanceOn(): boolean {
  const v = (process.env.MAINTENANCE_MODE || "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "on";
}

async function isAdmin(req: NextRequest): Promise<boolean> {
  if (!secret) return false;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
      audience: SESSION_AUD,
    });
    return String(payload.role) === "ADMIN";
  } catch {
    return false;
  }
}

// 처음 들어온 손님이면 어디서 왔는지 쿠키에 남긴다(가입 시 회원정보로 옮겨 관리자만 봄).
// 화면 요청(GET·HTML)만 — 화면 내부 이동/미리받기, API, 관리자 화면은 건너뜀.
function rememberFirstVisit(req: NextRequest, res: NextResponse, host: string) {
  if (req.method !== "GET" || req.cookies.has(SIGNUP_SRC_COOKIE)) return res;
  if (!(req.headers.get("accept") || "").includes("text/html")) return res;
  if (req.headers.get("rsc") || req.headers.get("next-router-prefetch")) return res;
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/api/") || pathname === "/admin" || pathname.startsWith("/admin/")) return res;

  const visit = buildFirstVisit(req.nextUrl, req.headers.get("referer"), host);
  res.cookies.set(SIGNUP_SRC_COOKIE, encodeFirstVisit(visit), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SIGNUP_SRC_MAX_AGE,
  });
  return res;
}

export async function proxy(req: NextRequest) {
  // www.getusim.com → getusim.com. 페이플에 getusim.com 만 등록돼 있어 www 에서 결제하면 AUTH0004 가 난다.
  const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "").toLowerCase();
  if (host.startsWith("www.")) {
    const url = new URL(req.nextUrl.pathname + req.nextUrl.search, `https://${host.slice(4)}`);
    return NextResponse.redirect(url, 308);
  }

  return rememberFirstVisit(req, await gate(req), host);
}

async function gate(req: NextRequest): Promise<NextResponse> {
  if (!maintenanceOn()) return NextResponse.next();

  const { pathname } = req.nextUrl;
  const allowed = ALLOW_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
  if (allowed) return NextResponse.next();

  if (await isAdmin(req)) return NextResponse.next();

  // 비관리자 → 점검 안내 페이지 (URL 유지, 503 응답)
  const url = req.nextUrl.clone();
  url.pathname = "/maintenance";
  return NextResponse.rewrite(url, { status: 503 });
}

export const config = {
  // 정적 자원/이미지/파비콘은 제외하고 모든 경로에서 동작
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
