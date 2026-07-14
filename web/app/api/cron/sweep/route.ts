import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { expireStaleRentals } from "@/lib/rentals";
import { expireStaleChargeOrders } from "@/lib/charge";

// 주기 정리 작업(외부 크론에서 호출).
//  · 만료된 SMS 발급건: 코드 도착했으면 정산, 아니면 5sim 취소(원가 환불) 후 EXPIRED
//    → 사용자가 대기 중 탭을 닫으면 클라이언트 타이머가 죽어 아무도 취소해주지 않는다.
//  · 자동매칭 기간이 지난 미입금 충전 주문: CANCELED
// 보안: 환경변수 CRON_TOKEN 과 일치하는 X-Cron-Token 헤더(또는 ?token=) 필요.
export const dynamic = "force-dynamic";

function tokenEquals(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

async function sweep(req: Request) {
  const secret = process.env.CRON_TOKEN;
  const token =
    req.headers.get("x-cron-token") || new URL(req.url).searchParams.get("token") || "";
  if (!secret || !tokenEquals(token, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 한쪽이 실패해도 다른 쪽은 진행되도록 격리
  const [rentals, charges] = await Promise.allSettled([
    expireStaleRentals(),
    expireStaleChargeOrders(),
  ]);

  return NextResponse.json({
    ok: true,
    rentals: rentals.status === "fulfilled" ? "done" : "failed",
    chargesCanceled: charges.status === "fulfilled" ? charges.value : "failed",
  });
}

// 크론 서비스에 따라 GET만 지원하는 경우가 있어 둘 다 받는다.
export const GET = sweep;
export const POST = sweep;
