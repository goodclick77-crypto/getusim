import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { BANK_INFO } from "@/lib/deposit-account";

// 충전 페이지 "복사" 버튼 전용. 계좌번호를 페이지 HTML에 싣지 않고, 로그인 사용자가
// 버튼을 눌렀을 때만 숫자만(하이픈 제거) 텍스트로 내려준다. 화면 표시는 ./image 가 담당.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new NextResponse(null, { status: 401 });

  return new NextResponse(BANK_INFO.account.replace(/[^\d]/g, ""), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
