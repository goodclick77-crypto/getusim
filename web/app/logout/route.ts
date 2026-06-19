import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

// POST 에서만 세션 삭제 (GET 프리페치가 로그아웃시키는 문제 방지)
export async function POST(req: Request) {
  const res = NextResponse.redirect(new URL("/", req.url), 303);
  res.cookies.delete(SESSION_COOKIE);
  return res;
}

// GET 은 프리페치 안전성을 위해 세션을 건드리지 않고 홈으로만 이동
export async function GET(req: Request) {
  return NextResponse.redirect(new URL("/", req.url));
}
