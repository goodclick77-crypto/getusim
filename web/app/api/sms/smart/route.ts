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

// 스마트 발급 — 서비스만 받아서 "지금 가장 잘 받아지는" 국가·통신사 하나를 골라준다.
// 회원이 국가 목록에서 직접 고를 때 놓치기 쉬운 최적 조합을 대신 집어주는 역할.
// countries 라우트와 판단 기준(재고·단가·수신률)은 동일하고, 전체 목록 대신 1등만 돌려준다.
// 통신사(operator)까지 함께 주는 점이 다르다 — 발급 때 그대로 써서 재조회 없이 같은 번호를 산다.
// 가격은 공개 정보 → 비회원도 조회 가능.
export async function GET(req: Request) {
  const service = new URL(req.url).searchParams.get("service") || "";
  if (!SERVICES.some((s) => s.value === service)) {
    return NextResponse.json({ pick: null });
  }

  let data: PricesResponse = {};
  try {
    data = await fivesim.prices({ product: service });
  } catch {
    return NextResponse.json({ pick: null });
  }

  const fx = await getUsdKrw();
  // product 쿼리 응답은 { product: { country: {...} } } 구조
  const byCountry = data?.[service] ?? {};

  let best: {
    country: string;
    label: string;
    iso: string;
    operator: string;
    cost: number;
    rate: number;
    stock: number;
  } | null = null;

  for (const c of COUNTRIES) {
    // 5sim 재고 표시를 못 믿는다 — 실제로 사봤다가 "번호 없음"이 확인된 조합은 건너뛴다.
    if (isUnavailable(c.value, service)) continue;
    for (const [operator, info] of Object.entries(byCountry[c.value] ?? {})) {
      const cost = Number(info?.cost);
      const count = Number(info?.count);
      const rate = deliveryRate(info);
      if (count <= FIVESIM_MIN_STOCK || cost > FIVESIM_MAX_PRICE) continue;
      if (rate <= FIVESIM_MIN_RATE) continue;
      // 수신률 우선, 동률이면 싼 쪽
      if (!best || rate > best.rate || (rate === best.rate && cost < best.cost)) {
        best = {
          country: c.value,
          label: c.label,
          iso: c.iso,
          operator,
          cost,
          rate,
          stock: count,
        };
      }
    }
  }

  // 조건을 만족하는 조합이 없을 수 있다(수신률 낮은 서비스). 이땐 화면에서 수동 탭을 안내한다.
  if (!best) return NextResponse.json({ pick: null });

  return NextResponse.json({
    pick: {
      country: best.country,
      label: best.label,
      iso: best.iso,
      operator: best.operator,
      price: smsPointPrice(best.cost, fx),
      rate: Math.round(best.rate),
      stock: best.stock,
    },
  });
}
