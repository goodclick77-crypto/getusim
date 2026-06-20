// 서비스 운영 상수 (추후 DB 설정/관리자 화면으로 이전 가능)

/** 무통장입금 안내 계좌 (레거시와 동일: 국민 681702-00-118395 엄전혜) */
export const BANK_INFO = {
  bank: process.env.DEPOSIT_BANK || "국민은행",
  account: process.env.DEPOSIT_ACCOUNT || "681702-00-118395",
  holder: process.env.DEPOSIT_HOLDER || "엄전혜",
};

/** 충전 패키지 (결제금액 → 지급 포인트). 가격 = 포인트 × 1.1 */
export const CHARGE_PACKAGES = [
  { price: 11_000, point: 10_000 },
  { price: 33_000, point: 30_000 },
  { price: 55_000, point: 50_000 },
  { price: 110_000, point: 100_000 },
  { price: 330_000, point: 300_000 },
];

// ---------------- SMS 인증(5sim) ----------------

/** 기본/최소 차감 포인트 (싼 서비스) */
export const SMS_BASE_POINT = Number(process.env.SMS_BASE_POINT || 1000);

/** 번호 발급 시도를 위한 최소 보유 포인트 */
export const SMS_MIN_POINT = SMS_BASE_POINT;

/** 정액(1000P) 적용 상한 원가(USD). 이하면 1000P 정액 */
export const SMS_FREE_THRESHOLD_USD = Number(process.env.SMS_FREE_THRESHOLD_USD || 0.3);
/** USD→원 환산 (마진 계산용) */
export const SMS_USD_TO_KRW = Number(process.env.SMS_USD_TO_KRW || 1400);
/** 임계 초과분 마진 배수 */
export const SMS_MARKUP = Number(process.env.SMS_MARKUP || 2);

/**
 * 5sim 원가(USD) → 사용자 차감 포인트.
 *  - 원가 ≤ 0.3$  : 1,000P 정액
 *  - 원가 > 0.3$  : 원가 × 환율 × 2배 (100P 단위 올림), 최소 1,000P
 */
export function smsPointPrice(usd: number): number {
  if (!usd || usd <= SMS_FREE_THRESHOLD_USD) return SMS_BASE_POINT;
  const krw = usd * SMS_USD_TO_KRW * SMS_MARKUP;
  return Math.max(SMS_BASE_POINT, Math.ceil(krw / 100) * 100);
}

/** 5sim 구매 단가 상한 — 초과 시 "번호 없음" 처리.
 * 실제 단가가 telegram 등은 0.7~1.0 수준이라 너무 낮으면 전부 막힘.
 * pickOperator가 어차피 최저가 통신사를 고르므로 상한은 안전장치 역할.
 * 마진을 더 타이트하게 하려면 FIVESIM_MAX_PRICE 환경변수로 낮추세요. */
export const FIVESIM_MAX_PRICE = Number(process.env.FIVESIM_MAX_PRICE || 10);

/** 통신사 자동선택 시 최소 재고 (원본: 10개 초과) */
export const FIVESIM_MIN_STOCK = Number(process.env.FIVESIM_MIN_STOCK || 10);

/** 국가 목록 (value=5sim 코드, iso=국기코드, label=한글) — 레거시 드롭다운 동일 */
export const COUNTRIES: { value: string; iso: string; label: string }[] = [
  { value: "usa", iso: "us", label: "미국" },
  { value: "ukraine", iso: "ua", label: "우크라이나" },
  { value: "argentina", iso: "ar", label: "아르헨티나" },
  { value: "belarus", iso: "by", label: "벨라루스" },
  { value: "belgium", iso: "be", label: "벨기에" },
  { value: "brazil", iso: "br", label: "브라질" },
  { value: "cambodia", iso: "kh", label: "캄보디아" },
  { value: "canada", iso: "ca", label: "캐나다" },
  { value: "china", iso: "cn", label: "중국" },
  { value: "england", iso: "gb", label: "영국" },
  { value: "france", iso: "fr", label: "프랑스" },
  { value: "italy", iso: "it", label: "이탈리아" },
  { value: "malaysia", iso: "my", label: "말레이시아" },
  { value: "mexico", iso: "mx", label: "멕시코" },
  { value: "morocco", iso: "ma", label: "모로코" },
  { value: "netherlands", iso: "nl", label: "네덜란드" },
  { value: "poland", iso: "pl", label: "폴란드" },
  { value: "portugal", iso: "pt", label: "포르투갈" },
  { value: "russia", iso: "ru", label: "러시아" },
  { value: "singapore", iso: "sg", label: "싱가포르" },
  { value: "spain", iso: "es", label: "스페인" },
  { value: "australia", iso: "au", label: "호주" },
  { value: "vietnam", iso: "vn", label: "베트남" },
];

// ---- 국가/서비스 조회 헬퍼 (내역 표시용) ----
export function countryFlag(value: string): string | null {
  const c = COUNTRIES.find((x) => x.value === value);
  return c ? `https://flagcdn.com/w40/${c.iso}.png` : null;
}
export function countryLabel(value: string): string {
  return COUNTRIES.find((x) => x.value === value)?.label || value;
}
export function serviceLogo(value: string): string {
  const s = SERVICES.find((x) => x.value === value);
  return `https://cdn.simpleicons.org/${s?.slug || value}`;
}
export function serviceLabel(value: string): string {
  return SERVICES.find((x) => x.value === value)?.label || value;
}

/** 서비스 목록 (value=5sim product, slug=simpleicons 로고, label=한글)
 *  레거시 채널 드롭다운(naver·google·instagram·facebook·twitter·discord) +
 *  실사용 핵심(telegram·whatsapp)만 노출. 추가는 여기에. */
export const SERVICES: { value: string; slug: string; label: string }[] = [
  { value: "telegram", slug: "telegram", label: "텔레그램" },
  { value: "whatsapp", slug: "whatsapp", label: "왓츠앱" },
  { value: "google", slug: "google", label: "구글" },
  { value: "naver", slug: "naver", label: "네이버" },
  { value: "instagram", slug: "instagram", label: "인스타그램" },
  { value: "facebook", slug: "facebook", label: "페이스북" },
  { value: "twitter", slug: "x", label: "트위터(X)" },
  { value: "discord", slug: "discord", label: "디스코드" },
];
