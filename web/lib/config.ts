// 서비스 운영 상수 (추후 DB 설정/관리자 화면으로 이전 가능)

/** 무통장입금 안내 계좌 */
export const BANK_INFO = {
  bank: process.env.DEPOSIT_BANK || "국민은행",
  account: process.env.DEPOSIT_ACCOUNT || "000000-00-000000",
  holder: process.env.DEPOSIT_HOLDER || "(주)겟유심",
};

/** 충전 패키지 (결제금액 → 지급 포인트). 보너스 포함. */
export const CHARGE_PACKAGES = [
  { price: 10_000, point: 10_000 },
  { price: 30_000, point: 31_000 },
  { price: 50_000, point: 53_000 },
  { price: 100_000, point: 110_000 },
  { price: 300_000, point: 340_000 },
];

// ---------------- SMS 인증(5sim) ----------------

/** 인증코드 1건 수신 시 정액 차감 포인트 (원본: 1000) */
export const SMS_COST_POINT = Number(process.env.SMS_COST_POINT || 1000);

/** 번호 발급을 위한 최소 보유 포인트 (원본: 1000) */
export const SMS_MIN_POINT = SMS_COST_POINT;

/** 5sim 구매 단가 상한 — 초과 시 "번호 없음" 처리 (원본: 0.2). 번호가 안 잡히면 올리세요. */
export const FIVESIM_MAX_PRICE = Number(process.env.FIVESIM_MAX_PRICE || 0.2);

/** 통신사 자동선택 시 최소 재고 (원본: 10개 초과) */
export const FIVESIM_MIN_STOCK = Number(process.env.FIVESIM_MIN_STOCK || 10);

/** 국가 목록 (value=5sim 코드, label=한글) — 원본 드롭다운 동일 */
export const COUNTRIES: { value: string; label: string }[] = [
  { value: "usa", label: "미국" },
  { value: "ukraine", label: "우크라이나" },
  { value: "argentina", label: "아르헨티나" },
  { value: "belarus", label: "벨라루스" },
  { value: "belgium", label: "벨기에" },
  { value: "brazil", label: "브라질" },
  { value: "cambodia", label: "캄보디아" },
  { value: "canada", label: "캐나다" },
  { value: "china", label: "중국" },
  { value: "england", label: "영국" },
  { value: "france", label: "프랑스" },
  { value: "italy", label: "이탈리아" },
  { value: "malaysia", label: "말레이시아" },
  { value: "mexico", label: "멕시코" },
  { value: "morocco", label: "모로코" },
  { value: "netherlands", label: "네덜란드" },
  { value: "poland", label: "폴란드" },
  { value: "portugal", label: "포르투갈" },
  { value: "russia", label: "러시아" },
  { value: "singapore", label: "싱가포르" },
  { value: "spain", label: "스페인" },
  { value: "australia", label: "호주" },
  { value: "vietnam", label: "베트남" },
];

/** 서비스(채널) 목록 — 레거시 check.php 지원 서비스 전체 */
export const SERVICES: { value: string; label: string }[] = [
  { value: "telegram", label: "텔레그램" },
  { value: "whatsapp", label: "왓츠앱" },
  { value: "kakaotalk", label: "카카오톡" },
  { value: "naver", label: "네이버" },
  { value: "google", label: "구글" },
  { value: "facebook", label: "페이스북" },
  { value: "instagram", label: "인스타그램" },
  { value: "twitter", label: "트위터(X)" },
  { value: "discord", label: "디스코드" },
  { value: "tiktok", label: "틱톡" },
  { value: "wechat", label: "위챗" },
  { value: "line", label: "라인" },
  { value: "michat", label: "미챗" },
  { value: "amazon", label: "아마존" },
  { value: "ebay", label: "이베이" },
  { value: "paypal", label: "페이팔" },
  { value: "steam", label: "스팀" },
  { value: "snapchat", label: "스냅챗" },
  { value: "netflix", label: "넷플릭스" },
  { value: "alibaba", label: "알리바바" },
  { value: "aliexpress", label: "알리익스프레스" },
  { value: "taobao", label: "타오바오" },
  { value: "blizzard", label: "블리자드" },
];
