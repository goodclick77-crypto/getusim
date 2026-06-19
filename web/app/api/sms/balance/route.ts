import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { fivesim, FiveSimError } from "@/lib/fivesim";

// 5sim 계정 잔액 (관리자 전용)
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
  }
  try {
    const profile = await fivesim.profile();
    return NextResponse.json({ balance: profile.balance });
  } catch (e) {
    const msg = e instanceof FiveSimError ? e.message : "조회 실패";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
