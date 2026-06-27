import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { sendTestEmail } from "@/lib/notify";

// 관리자 알림설정 화면의 '테스트 메일 보내기' (즉시 결과 반환)
// ?to=주소 를 주면 그 주소로 발송 시도(일반 사용자 메일 발송 진단용).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "권한이 없습니다" }, { status: 403 });
  }
  const to = (new URL(req.url).searchParams.get("to") || "").trim();
  const res = await sendTestEmail(to || undefined);
  return NextResponse.json(res);
}
