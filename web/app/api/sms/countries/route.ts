import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { fivesim } from "@/lib/fivesim";
import { getUsdKrw } from "@/lib/fx";
import {
  COUNTRIES,
  SERVICES,
  FIVESIM_MAX_PRICE,
  FIVESIM_MIN_STOCK,
  FIVESIM_MIN_RATE,
  smsPointPrice,
} from "@/lib/config";

// 서비스 선택 시 잘 받아지는 국가 비교 (수신률 높은 순, 번호없음/0% 제외)
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "login" }, { status: 401 });

  const service = new URL(req.url).searchParams.get("service") || "";
  if (!SERVICES.some((s) => s.value === service)) {
    return NextResponse.json({ countries: [] });
  }

  let data: Record<string, Record<string, Record<string, { cost: number; count: number; rate?: number }>>> = {};
  try {
    data = (await fivesim.prices({ product: service })) as typeof data;
  } catch {
    return NextResponse.json({ countries: [] });
  }

  const fx = await getUsdKrw();
  // product 쿼리 응답은 { product: { country: {...} } } 구조
  const countries = COUNTRIES.flatMap((c) => {
    const ops = data?.[service]?.[c.value] ?? {};
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
    if (!best || best.rate <= FIVESIM_MIN_RATE) return [];
    return [
      {
        value: c.value,
        label: c.label,
        iso: c.iso,
        price: smsPointPrice(best.cost, fx),
        rate: Math.round(best.rate),
        stock: best.count,
      },
    ];
  });

  countries.sort((a, b) => b.rate - a.rate);
  return NextResponse.json({ countries });
}
