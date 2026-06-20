import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { sendTestEmail } from "@/lib/notify";

// 관리자 알림설정 화면의 '테스트 메일 보내기' (즉시 결과 반환)
export async function POST() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "권한이 없습니다" }, { status: 403 });
  }
  const res = await sendTestEmail();
  return NextResponse.json(res);
}
