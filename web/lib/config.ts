// 서비스 운영 상수 (추후 DB 설정/관리자 화면으로 이전 가능)

/** 무통장입금 안내 계좌 (농협 302-0809-3953-71 겟유심) */
export const BANK_INFO = {
  bank: process.env.DEPOSIT_BANK || "농협은행",
  account: process.env.DEPOSIT_ACCOUNT || "302-0809-3953-71",
  holder: process.env.DEPOSIT_HOLDER || "겟유심",
};

/** 충전 포인트 단위(클릭하면 누적). 1만P를 두 번 누르면 2만P. */
export const CHARGE_POINT_UNITS = [1_000, 3_000, 5_000, 10_000, 50_000, 100_000];
/** 입금액 = 포인트 × 1.1 (10% 수수료). 예: 10,000P → 11,000원 */
export const CHARGE_FEE_RATE = 1.1;
export const CHARGE_MIN_POINT = 1_000;
export const CHARGE_MAX_POINT = 10_000_000;

/** 충전 포인트에 대한 실제 입금(결제) 금액(원) */
export function chargeAmount(point: number): number {
  return Math.round(point * CHARGE_FEE_RATE);
}

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
export function smsPointPrice(usd: number, rate: number = SMS_USD_TO_KRW): number {
  if (!usd || usd <= SMS_FREE_THRESHOLD_USD) return SMS_BASE_POINT;
  const krw = usd * rate * SMS_MARKUP;
  return Math.max(SMS_BASE_POINT, Math.ceil(krw / 100) * 100);
}

/** 5sim 구매 단가 상한 — 초과 시 "번호 없음" 처리.
 * 실제 단가가 telegram 등은 0.7~1.0 수준이라 너무 낮으면 전부 막힘.
 * pickOperator가 어차피 최저가 통신사를 고르므로 상한은 안전장치 역할.
 * 마진을 더 타이트하게 하려면 FIVESIM_MAX_PRICE 환경변수로 낮추세요. */
export const FIVESIM_MAX_PRICE = Number(process.env.FIVESIM_MAX_PRICE || 10);

/** 통신사 자동선택 시 최소 재고 (원본: 10개 초과) */
export const FIVESIM_MIN_STOCK = Number(process.env.FIVESIM_MIN_STOCK || 10);

/** 목록 노출 최소 수신률(%). 이 값 이하(예: 10% 이하)는 숨김 */
export const FIVESIM_MIN_RATE = Number(process.env.FIVESIM_MIN_RATE || 10);

/** 국가 목록 (value=5sim 코드, iso=국기코드, label=한글) — 레거시 드롭다운 동일 */
export const COUNTRIES: { value: string; iso: string; label: string }[] = [
  { value: "ghana", iso: "gh", label: "가나" },
  { value: "gabon", iso: "ga", label: "가봉" },
  { value: "guyana", iso: "gy", label: "가이아나" },
  { value: "gambia", iso: "gm", label: "감비아" },
  { value: "guadeloupe", iso: "gp", label: "과들루프" },
  { value: "guatemala", iso: "gt", label: "과테말라" },
  { value: "greece", iso: "gr", label: "그리스" },
  { value: "guinea", iso: "gn", label: "기니" },
  { value: "guineabissau", iso: "gw", label: "기니비사우" },
  { value: "namibia", iso: "na", label: "나미비아" },
  { value: "nigeria", iso: "ng", label: "나이지리아" },
  { value: "southafrica", iso: "za", label: "남아프리카공화국" },
  { value: "netherlands", iso: "nl", label: "네덜란드" },
  { value: "nepal", iso: "np", label: "네팔" },
  { value: "norway", iso: "no", label: "노르웨이" },
  { value: "nicaragua", iso: "ni", label: "니카라과" },
  { value: "taiwan", iso: "tw", label: "대만" },
  { value: "denmark", iso: "dk", label: "덴마크" },
  { value: "dominicana", iso: "do", label: "도미니카공화국" },
  { value: "germany", iso: "de", label: "독일" },
  { value: "easttimor", iso: "tl", label: "동티모르" },
  { value: "laos", iso: "la", label: "라오스" },
  { value: "liberia", iso: "lr", label: "라이베리아" },
  { value: "latvia", iso: "lv", label: "라트비아" },
  { value: "lesotho", iso: "ls", label: "레소토" },
  { value: "reunion", iso: "re", label: "레위니옹" },
  { value: "romania", iso: "ro", label: "루마니아" },
  { value: "luxembourg", iso: "lu", label: "룩셈부르크" },
  { value: "rwanda", iso: "rw", label: "르완다" },
  { value: "lithuania", iso: "lt", label: "리투아니아" },
  { value: "madagascar", iso: "mg", label: "마다가스카르" },
  { value: "macau", iso: "mo", label: "마카오" },
  { value: "malawi", iso: "mw", label: "말라위" },
  { value: "malaysia", iso: "my", label: "말레이시아" },
  { value: "mexico", iso: "mx", label: "멕시코" },
  { value: "morocco", iso: "ma", label: "모로코" },
  { value: "mauritius", iso: "mu", label: "모리셔스" },
  { value: "mauritania", iso: "mr", label: "모리타니" },
  { value: "mozambique", iso: "mz", label: "모잠비크" },
  { value: "montenegro", iso: "me", label: "몬테네그로" },
  { value: "moldova", iso: "md", label: "몰도바" },
  { value: "maldives", iso: "mv", label: "몰디브" },
  { value: "mongolia", iso: "mn", label: "몽골" },
  { value: "usa", iso: "us", label: "미국" },
  { value: "bahrain", iso: "bh", label: "바레인" },
  { value: "barbados", iso: "bb", label: "바베이도스" },
  { value: "bahamas", iso: "bs", label: "바하마" },
  { value: "bangladesh", iso: "bd", label: "방글라데시" },
  { value: "benin", iso: "bj", label: "베냉" },
  { value: "venezuela", iso: "ve", label: "베네수엘라" },
  { value: "vietnam", iso: "vn", label: "베트남" },
  { value: "belgium", iso: "be", label: "벨기에" },
  { value: "belize", iso: "bz", label: "벨리즈" },
  { value: "bih", iso: "ba", label: "보스니아헤르체고비나" },
  { value: "botswana", iso: "bw", label: "보츠와나" },
  { value: "bolivia", iso: "bo", label: "볼리비아" },
  { value: "burundi", iso: "bi", label: "부룬디" },
  { value: "burkinafaso", iso: "bf", label: "부르키나파소" },
  { value: "bhutane", iso: "bt", label: "부탄" },
  { value: "northmacedonia", iso: "mk", label: "북마케도니아" },
  { value: "bulgaria", iso: "bg", label: "불가리아" },
  { value: "brazil", iso: "br", label: "브라질" },
  { value: "samoa", iso: "ws", label: "사모아" },
  { value: "saudiarabia", iso: "sa", label: "사우디아라비아" },
  { value: "senegal", iso: "sn", label: "세네갈" },
  { value: "serbia", iso: "rs", label: "세르비아" },
  { value: "seychelles", iso: "sc", label: "세이셸" },
  { value: "saintlucia", iso: "lc", label: "세인트루시아" },
  { value: "saintvincentandgrenadines", iso: "vc", label: "세인트빈센트그레나딘" },
  { value: "saintkittsandnevis", iso: "kn", label: "세인트키츠네비스" },
  { value: "solomonislands", iso: "sb", label: "솔로몬제도" },
  { value: "suriname", iso: "sr", label: "수리남" },
  { value: "srilanka", iso: "lk", label: "스리랑카" },
  { value: "sweden", iso: "se", label: "스웨덴" },
  { value: "spain", iso: "es", label: "스페인" },
  { value: "slovakia", iso: "sk", label: "슬로바키아" },
  { value: "slovenia", iso: "si", label: "슬로베니아" },
  { value: "sierraleone", iso: "sl", label: "시에라리온" },
  { value: "armenia", iso: "am", label: "아르메니아" },
  { value: "argentina", iso: "ar", label: "아르헨티나" },
  { value: "haiti", iso: "ht", label: "아이티" },
  { value: "ireland", iso: "ie", label: "아일랜드" },
  { value: "azerbaijan", iso: "az", label: "아제르바이잔" },
  { value: "afghanistan", iso: "af", label: "아프가니스탄" },
  { value: "albania", iso: "al", label: "알바니아" },
  { value: "algeria", iso: "dz", label: "알제리" },
  { value: "angola", iso: "ao", label: "앙골라" },
  { value: "antiguaandbarbuda", iso: "ag", label: "앤티가바부다" },
  { value: "swaziland", iso: "sz", label: "에스와티니" },
  { value: "estonia", iso: "ee", label: "에스토니아" },
  { value: "ecuador", iso: "ec", label: "에콰도르" },
  { value: "ethiopia", iso: "et", label: "에티오피아" },
  { value: "salvador", iso: "sv", label: "엘살바도르" },
  { value: "england", iso: "gb", label: "영국" },
  { value: "oman", iso: "om", label: "오만" },
  { value: "austria", iso: "at", label: "오스트리아" },
  { value: "honduras", iso: "hn", label: "온두라스" },
  { value: "jordan", iso: "jo", label: "요르단" },
  { value: "uganda", iso: "ug", label: "우간다" },
  { value: "uruguay", iso: "uy", label: "우루과이" },
  { value: "uzbekistan", iso: "uz", label: "우즈베키스탄" },
  { value: "israel", iso: "il", label: "이스라엘" },
  { value: "egypt", iso: "eg", label: "이집트" },
  { value: "italy", iso: "it", label: "이탈리아" },
  { value: "india", iso: "in", label: "인도" },
  { value: "indonesia", iso: "id", label: "인도네시아" },
  { value: "jamaica", iso: "jm", label: "자메이카" },
  { value: "zambia", iso: "zm", label: "잠비아" },
  { value: "equatorialguinea", iso: "gq", label: "적도기니" },
  { value: "georgia", iso: "ge", label: "조지아" },
  { value: "djibouti", iso: "dj", label: "지부티" },
  { value: "chad", iso: "td", label: "차드" },
  { value: "czech", iso: "cz", label: "체코" },
  { value: "chile", iso: "cl", label: "칠레" },
  { value: "cameroon", iso: "cm", label: "카메룬" },
  { value: "capeverde", iso: "cv", label: "카보베르데" },
  { value: "kazakhstan", iso: "kz", label: "카자흐스탄" },
  { value: "cambodia", iso: "kh", label: "캄보디아" },
  { value: "canada", iso: "ca", label: "캐나다" },
  { value: "kenya", iso: "ke", label: "케냐" },
  { value: "comoros", iso: "km", label: "코모로" },
  { value: "costarica", iso: "cr", label: "코스타리카" },
  { value: "ivorycoast", iso: "ci", label: "코트디부아르" },
  { value: "colombia", iso: "co", label: "콜롬비아" },
  { value: "congo", iso: "cg", label: "콩고" },
  { value: "kuwait", iso: "kw", label: "쿠웨이트" },
  { value: "croatia", iso: "hr", label: "크로아티아" },
  { value: "kyrgyzstan", iso: "kg", label: "키르기스스탄" },
  { value: "cyprus", iso: "cy", label: "키프로스" },
  { value: "tajikistan", iso: "tj", label: "타지키스탄" },
  { value: "tanzania", iso: "tz", label: "탄자니아" },
  { value: "thailand", iso: "th", label: "태국" },
  { value: "togo", iso: "tg", label: "토고" },
  { value: "turkmenistan", iso: "tm", label: "투르크메니스탄" },
  { value: "tunisia", iso: "tn", label: "튀니지" },
  { value: "tit", iso: "tt", label: "트리니다드토바고" },
  { value: "panama", iso: "pa", label: "파나마" },
  { value: "paraguay", iso: "py", label: "파라과이" },
  { value: "pakistan", iso: "pk", label: "파키스탄" },
  { value: "papuanewguinea", iso: "pg", label: "파푸아뉴기니" },
  { value: "peru", iso: "pe", label: "페루" },
  { value: "portugal", iso: "pt", label: "포르투갈" },
  { value: "poland", iso: "pl", label: "폴란드" },
  { value: "puertorico", iso: "pr", label: "푸에르토리코" },
  { value: "france", iso: "fr", label: "프랑스" },
  { value: "frenchguiana", iso: "gf", label: "프랑스령기아나" },
  { value: "finland", iso: "fi", label: "핀란드" },
  { value: "philippines", iso: "ph", label: "필리핀" },
  { value: "hungary", iso: "hu", label: "헝가리" },
  { value: "australia", iso: "au", label: "호주" },
  { value: "hongkong", iso: "hk", label: "홍콩" },
  { value: "aruba", iso: "aw", label: "아루바" },
  { value: "newcaledonia", iso: "nc", label: "뉴칼레도니아" },
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
  { value: "kakaotalk", slug: "kakaotalk", label: "카카오톡" },
  { value: "naver", slug: "naver", label: "네이버" },
  { value: "line", slug: "line", label: "라인" },
  { value: "telegram", slug: "telegram", label: "텔레그램" },
  { value: "whatsapp", slug: "whatsapp", label: "왓츠앱" },
  { value: "google", slug: "google", label: "구글" },
  { value: "instagram", slug: "instagram", label: "인스타그램" },
  { value: "facebook", slug: "facebook", label: "페이스북" },
  { value: "twitter", slug: "x", label: "트위터(X)" },
  { value: "discord", slug: "discord", label: "디스코드" },
  { value: "tiktok", slug: "tiktok", label: "틱톡" },
  { value: "wechat", slug: "wechat", label: "위챗" },
  { value: "apple", slug: "apple", label: "애플" },
  { value: "paypal", slug: "paypal", label: "페이팔" },
  { value: "steam", slug: "steam", label: "스팀" },
  { value: "snapchat", slug: "snapchat", label: "스냅챗" },
];
