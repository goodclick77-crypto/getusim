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

// 국가 선택 시 전체 서비스의 수신률·재고·가격 비교표
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "login" }, { status: 401 });

  const country = new URL(req.url).searchParams.get("country") || "";
  if (!COUNTRIES.some((c) => c.value === country)) {
    return NextResponse.json({ services: [] });
  }

  let data: Record<string, Record<string, Record<string, { cost: number; count: number; rate?: number }>>> = {};
  try {
    data = (await fivesim.prices({ country })) as typeof data;
  } catch {
    return NextResponse.json({ services: SERVICES.map((s) => ({ ...s, available: false })) });
  }

  const services = SERVICES.map((s) => {
    const ops = data?.[country]?.[s.value] ?? {};
    let best: { cost: number; rate: number; count: number } | null = null;
    for (const info of Object.values(ops)) {
      const cost = Number(info?.cost);
      const count = Number(info?.count);
      const rate = Number(info?.rate) || 0;
      if (count <= FIVESIM_MIN_STOCK || cost > FIVESIM_MAX_PRICE) continue;
      if (!best || rate > best.rate || (rate === best.rate && cost < best.cost)) {
        best = { cost, rate, count };
      }
    }
    return best
      ? {
          value: s.value,
          label: s.label,
          slug: s.slug,
          available: true,
          price: smsPointPrice(best.cost),
          rate: Math.round(best.rate),
          stock: best.count,
        }
      : { value: s.value, label: s.label, slug: s.slug, available: false };
  });

  // 가능한 것 먼저, 수신률 높은 순
  services.sort((a, b) => {
    if (a.available !== b.available) return a.available ? -1 : 1;
    return (b.rate ?? 0) - (a.rate ?? 0);
  });

  return NextResponse.json({ services });
}
