// 5sim.net API 클라이언트 — https://5sim.net/docs
// 가상번호 구매 → SMS 수신 확인 → 완료/취소.

const BASE = process.env.FIVESIM_BASE_URL || "https://5sim.net/v1";
const KEY = process.env.FIVESIM_API_KEY || "";

export type FiveSimSms = {
  created_at: string;
  date: string;
  sender: string;
  text: string;
  code: string;
};

export type FiveSimOrder = {
  id: number;
  phone: string;
  operator: string;
  product: string;
  price: number;
  status: string; // PENDING / RECEIVED / CANCELED / TIMEOUT / FINISHED / BANNED
  expires: string;
  sms: FiveSimSms[] | null;
  created_at: string;
  country: string;
};

// /guest/prices 응답: { country: { product: { operator: { cost, count, rate } } } }
export type PricesResponse = Record<
  string,
  Record<string, Record<string, { cost: number; count: number; rate?: number }>>
>;

class FiveSimError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "FiveSimError";
    this.status = status;
  }
}

async function call<T>(
  path: string,
  opts: { method?: string; auth?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.auth !== false) {
    if (!KEY) throw new FiveSimError("FIVESIM_API_KEY 미설정", 500);
    headers.Authorization = `Bearer ${KEY}`;
  }
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method || "GET",
    headers,
    cache: "no-store",
  });
  const body = await res.text();
  if (!res.ok) {
    throw new FiveSimError(body || res.statusText, res.status);
  }
  // 일부 응답이 빈 문자열일 수 있음
  return (body ? JSON.parse(body) : null) as T;
}

export const fivesim = {
  /** 계정 잔액/프로필 */
  profile: () => call<{ id: number; email: string; balance: number }>("/user/profile"),

  /** 게스트 가격표 (country/product 필터) */
  prices: (params: { country?: string; product?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.country) qs.set("country", params.country);
    if (params.product) qs.set("product", params.product);
    const q = qs.toString();
    return call<PricesResponse>(`/guest/prices${q ? `?${q}` : ""}`, {
      auth: false,
    });
  },

  /**
   * 재고(minStock) 초과 & 단가(maxPrice) 이하 중 **수신 성공률(rate)이 가장 높은** 통신사.
   * 동률이면 더 싼 쪽. 조건에 맞는 게 없으면 null.
   */
  bestOperator: async (
    country: string,
    product: string,
    maxPrice: number,
    minStock: number,
  ): Promise<{ operator: string; cost: number; rate: number } | null> => {
    const data = await call<PricesResponse>(
      `/guest/prices?country=${encodeURIComponent(country)}&product=${encodeURIComponent(product)}`,
      { auth: false },
    );
    const ops = data?.[country]?.[product] ?? {};
    let best: { operator: string; cost: number; rate: number } | null = null;
    for (const [op, info] of Object.entries(ops)) {
      const cost = Number(info?.cost);
      const count = Number(info?.count);
      const rate = Number(info?.rate) || 0;
      if (count <= minStock || cost > maxPrice) continue;
      if (!best || rate > best.rate || (rate === best.rate && cost < best.cost)) {
        best = { operator: op, cost, rate };
      }
    }
    return best;
  },

  /** 번호 구매 (활성화) */
  buyActivation: (country: string, operator: string, product: string) =>
    call<FiveSimOrder>(
      `/user/buy/activation/${encodeURIComponent(country)}/${encodeURIComponent(
        operator,
      )}/${encodeURIComponent(product)}`,
    ),

  /** 주문 상태/수신 SMS 확인 */
  check: (id: number | string) => call<FiveSimOrder>(`/user/check/${id}`),

  /** 주문 완료 처리 (SMS 수신 후) */
  finish: (id: number | string) => call<FiveSimOrder>(`/user/finish/${id}`),

  /** 주문 취소 (환불 대상) */
  cancel: (id: number | string) => call<FiveSimOrder>(`/user/cancel/${id}`),

  /** 번호 차단(잘못된 번호) */
  ban: (id: number | string) => call<FiveSimOrder>(`/user/ban/${id}`),
};

export { FiveSimError };
