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

/** 통신사 가격표 항목들 중 "수신률 높고, 같으면 싼" 최선 후보. 재고·단가 상한 밖은 제외. */
export function pickBestOperator(
  ops: Record<string, { cost?: number; count?: number; rate?: number; rate24?: number } | undefined>,
  allowShortWindow: boolean,
): { cost: number; rate: number; count: number } | null {
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
  return best;
}

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
      const best = pickBestOperator(data?.[service]?.[c.value] ?? {}, allowShortWindow);
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
  // 목록에서 숨긴("번호 없음" 확인) 조합은 주문 페이지에서도 팔지 않는다 — 결제했다가 바로 환불되는 일을 막는다.
  if (isUnavailable(country, service)) return null;
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

/**
 * 상품 목록용: 서비스별 "지금 가장 싼 국가의 가격"과 이용 가능 국가 수.
 * 서비스 수만큼 공급사 가격표를 조회하므로 결과를 잠시(기본 60초) 메모리에 캐시한다.
 * 조회 실패한 서비스는 null(화면에서 "가격 확인 중"으로).
 */
export type ServiceSummary = { minPrice: number; countries: number } | null;
const SUMMARY_CACHE_MS = Number(process.env.CATALOG_SUMMARY_CACHE_MS || 60 * 1000);
let summaryCache: { at: number; map: Map<string, ServiceSummary> } | null = null;

export async function listServiceSummaries(): Promise<Map<string, ServiceSummary>> {
  const now = Date.now();
  if (summaryCache && now - summaryCache.at < SUMMARY_CACHE_MS) return summaryCache.map;

  const results = await Promise.allSettled(
    SERVICES.map(async (s) => {
      const offers = await listCountryOffers(s.value);
      const summary: ServiceSummary = offers.length
        ? { minPrice: Math.min(...offers.map((o) => o.price)), countries: offers.length }
        : { minPrice: 0, countries: 0 };
      return [s.value, summary] as const;
    }),
  );
  const map = new Map<string, ServiceSummary>();
  results.forEach((r, i) => {
    map.set(SERVICES[i].value, r.status === "fulfilled" ? r.value[1] : null);
  });
  summaryCache = { at: now, map };
  return map;
}

