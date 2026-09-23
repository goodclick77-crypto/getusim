import "server-only";
import { fivesim, type PricesResponse } from "./fivesim";
import { getUsdKrw } from "./fx";
import {
  COUNTRIES,
  SERVICES,
  FIVESIM_MAX_PRICE,
  FIVESIM_MIN_STOCK,
  FIVESIM_MIN_RATE,
  deliveryRate,
  smsPointPrice,
} from "./config";
import { isUnavailable } from "./unavailable";
import { loadSuccessStats, pickSuccessStat, type SuccessStat } from "./success-rate";

/**
 * 상품 카탈로그: "서비스 × 국가 = 인증 1건" 상품의 가격·수신률 목록.
 * /api/sms/countries 와 상품 상세 페이지(/products/[service])가 같은 계산을 쓴다.
 */
export type CountryOffer = {
  value: string;
  label: string;
  iso: string;
  /** 차감 포인트(내부 단위). 회원 화면은 wonOf() 로 원 표시 */
  price: number;
  /** 5sim 최근 24시간 수신률(%) */
  rate: number;
  /** 겟유심 실측 성공률 (표본 부족이면 null) */
  ours: SuccessStat | null;
};

export async function listCountryOffers(service: string): Promise<CountryOffer[]> {
  if (!SERVICES.some((s) => s.value === service)) return [];

  let data: PricesResponse = {};
  try {
    data = await fivesim.prices({ product: service });
  } catch {
    return [];
  }

  const [fx, stats] = await Promise.all([getUsdKrw(), loadSuccessStats()]);
  const build = (allowShortWindow: boolean) =>
    COUNTRIES.flatMap((c) => {
      // 사봤다가 "번호 없음"이 확인된 조합은 숨긴다 — 5sim 재고 표시가 실제와 맞지 않는다.
      if (isUnavailable(c.value, service)) return [];
      const ops = data?.[service]?.[c.value] ?? {};
      let best: { cost: number; rate: number; count: number } | null = null;
      for (const info of Object.values(ops)) {
        const cost = Number(info?.cost);
        const count = Number(info?.count);
        const rate = deliveryRate(info, allowShortWindow);
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
          ours: pickSuccessStat(stats, c.value, service),
        },
      ];
    });

  // 24시간 통계 기준으로 먼저 뽑고, 하나도 없으면(5sim이 rate24를 안 주는 상황) 1시간 기준으로 되돌린다.
  const strict = build(false);
  const offers = strict.length > 0 ? strict : build(true);
  offers.sort((a, b) => b.rate - a.rate);
  return offers;
}

/** 특정 (국가, 서비스) 상품의 현재 가격·수신률. 재고 없으면 null. */
export async function quoteOffer(
  country: string,
  service: string,
): Promise<{ price: number; rate: number } | null> {
  if (!COUNTRIES.some((c) => c.value === country) || !SERVICES.some((s) => s.value === service)) {
    return null;
  }
  try {
    const [pick, fx] = await Promise.all([
      fivesim.bestOperator(country, service, FIVESIM_MAX_PRICE, FIVESIM_MIN_STOCK),
      getUsdKrw(),
    ]);
    if (!pick) return null;
    return { price: smsPointPrice(pick.cost, fx), rate: Math.round(pick.rate) };
  } catch {
    return null;
  }
}
