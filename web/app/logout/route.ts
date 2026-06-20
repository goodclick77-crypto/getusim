import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

// 상대경로 Location("/")으로 리다이렉트 → 프록시(Railway) 뒤에서 req.url이 내부주소(localhost)로
// 잡혀 거기로 튕기는 문제 방지. 상대경로는 브라우저가 현재 접속 도메인 기준으로 이동.
function redirectHome() {
  return new NextResponse(null, { status: 303, headers: { Location: "/" } });
}

// POST 에서만 세션 삭제 (GET 프리페치가 로그아웃시키는 문제 방지)
export async function POST() {
  const res = redirectHome();
  res.cookies.delete(SESSION_COOKIE);
  return res;
}

// GET 은 프리페치 안전성을 위해 세션을 건드리지 않고 홈으로만 이동
export async function GET() {
  return redirectHome();
}
