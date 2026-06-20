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

  const fx = await getUsdKrw();
  const services = SERVICES.flatMap((s) => {
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
    // 번호 없음 / 수신률 낮은 조합(기본 10% 이하) 제외
    if (!best || best.rate <= FIVESIM_MIN_RATE) return [];
    return [
      {
        value: s.value,
        label: s.label,
        slug: s.slug,
        available: true,
        price: smsPointPrice(best.cost, fx),
        rate: Math.round(best.rate),
        stock: best.count,
      },
    ];
  });

  services.sort((a, b) => b.rate - a.rate);
  return NextResponse.json({ services });
}
