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

// 서비스 선택 시 잘 받아지는 국가 비교 (가격은 공개 정보 → 비회원도 조회 가능)
export async function GET(req: Request) {
  const service = new URL(req.url).searchParams.get("service") || "";
  if (!SERVICES.some((s) => s.value === service)) {
    return NextResponse.json({ countries: [] });
  }

  let data: PricesResponse = {};
  try {
    data = await fivesim.prices({ product: service });
  } catch {
    return NextResponse.json({ countries: [] });
  }

  const fx = await getUsdKrw();
  // product 쿼리 응답은 { product: { country: {...} } } 구조
  const countries = COUNTRIES.flatMap((c) => {
    // 사봤다가 "번호 없음"이 확인된 조합은 숨긴다 — 5sim 재고 표시가 실제와 맞지 않는다.
    if (isUnavailable(c.value, service)) return [];
    const ops = data?.[service]?.[c.value] ?? {};
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
