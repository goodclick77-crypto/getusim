import { NextResponse } from "next/server";
import { fivesim, type PricesResponse } from "@/lib/fivesim";
import { getUsdKrw } from "@/lib/fx";
import {
  COUNTRIES,
  SERVICES,
  FIVESIM_MAX_PRICE,
  FIVESIM_MIN_STOCK,
  FIVESIM_MIN_RATE,
  deliveryRate,
  smsPointPrice,
} from "@/lib/config";
import { isUnavailable } from "@/lib/unavailable";

// 국가 선택 시 전체 서비스의 수신률·재고·가격 비교표 (가격은 공개 정보 → 비회원도 조회 가능)
export async function GET(req: Request) {
  const country = new URL(req.url).searchParams.get("country") || "";
  if (!COUNTRIES.some((c) => c.value === country)) {
    return NextResponse.json({ services: [] });
  }

  let data: PricesResponse = {};
  try {
    data = await fivesim.prices({ country });
  } catch {
    return NextResponse.json({ services: SERVICES.map((s) => ({ ...s, available: false })) });
  }

  const fx = await getUsdKrw();
  const services = SERVICES.flatMap((s) => {
    // 사봤다가 "번호 없음"이 확인된 조합은 숨긴다 — 5sim 재고 표시가 실제와 맞지 않는다.
    if (isUnavailable(country, s.value)) return [];
    const ops = data?.[country]?.[s.value] ?? {};
    let best: { cost: number; rate: number; count: number } | null = null;
    for (const info of Object.values(ops)) {
      const cost = Number(info?.cost);
      const count = Number(info?.count);
      const rate = deliveryRate(info);
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
