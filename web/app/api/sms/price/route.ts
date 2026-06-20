import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { fivesim } from "@/lib/fivesim";
import {
  COUNTRIES,
  SERVICES,
  FIVESIM_MAX_PRICE,
  FIVESIM_MIN_STOCK,
  smsPointPrice,
} from "@/lib/config";

// 구매 전 예상 차감 포인트 안내 (최저가 통신사 원가 기준)
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "login" }, { status: 401 });

  const url = new URL(req.url);
  const country = url.searchParams.get("country") || "";
  const service = url.searchParams.get("service") || "";
  if (
    !COUNTRIES.some((c) => c.value === country) ||
    !SERVICES.some((s) => s.value === service)
  ) {
    return NextResponse.json({ available: false });
  }

  try {
    const pick = await fivesim.bestOperator(country, service, FIVESIM_MAX_PRICE, FIVESIM_MIN_STOCK);
    if (!pick) return NextResponse.json({ available: false });
    return NextResponse.json({
      available: true,
      price: smsPointPrice(pick.cost),
      rate: Math.round(pick.rate),
    });
  } catch {
    return NextResponse.json({ available: false });
  }
}
