import { NextResponse } from "next/server";
import { fivesim, type PricesResponse } from "@/lib/fivesim";
import { getUsdKrw } from "@/lib/fx";
import { COUNTRIES, SERVICES, FIVESIM_MIN_RATE, smsPointPrice } from "@/lib/config";
import { pickBestOperator } from "@/lib/catalog";
import { isUnavailable } from "@/lib/unavailable";
import { loadSuccessStats, pickSuccessStat } from "@/lib/success-rate";

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

  // 겟유심 자체 실측 성공률(최근 N일). 5sim 통계와 별개로 같이 보여준다.
  const [fx, stats] = await Promise.all([getUsdKrw(), loadSuccessStats()]);
  const build = (allowShortWindow: boolean) =>
    SERVICES.flatMap((s) => {
      // 사봤다가 "번호 없음"이 확인된 조합은 숨긴다 — 5sim 재고 표시가 실제와 맞지 않는다.
      if (isUnavailable(country, s.value)) return [];
      const best = pickBestOperator(data?.[country]?.[s.value] ?? {}, allowShortWindow);
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
          ours: pickSuccessStat(stats, country, s.value),
        },
      ];
    });

  // 24시간 통계 기준 우선, 하나도 없으면 1시간 기준으로 되돌린다(목록이 통째로 비는 것 방지).
  const strict = build(false);
  const services = strict.length > 0 ? strict : build(true);

  services.sort((a, b) => b.rate - a.rate);
  return NextResponse.json({ services });
}
