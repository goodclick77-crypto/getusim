// 가입 경로(유입 경로) 기록 — 관리자만 본다.
//   · proxy.ts: 처음 들어온 순간의 "직전 사이트·첫 화면·링크 표시(?from= / ?utm_source=)"를 쿠키에 저장
//   · /api/register: 가입할 때 쿠키 + 손님이 직접 적은 답을 User.extra.signup 에 저장
//   · 관리자 회원 화면: sourceLabel() 로 짧게 표시
// proxy 에서도 쓰므로 server-only 를 붙이지 않는다.

export const SIGNUP_SRC_COOKIE = "gu_src";
export const SIGNUP_SRC_MAX_AGE = 60 * 60 * 24 * 90; // 90일 — 둘러보다 며칠 뒤 가입해도 첫 경로 유지

/** 쿠키에 담는 첫 방문 정보 */
export type FirstVisit = {
  ref: string; // 직전 사이트 주소(외부만, 없으면 "")
  landing: string; // 처음 본 화면 경로
  from: string; // 링크에 붙인 표시(?from= 또는 ?utm_source=)
  at: string; // 처음 들어온 시각(ISO)
};

/** User.extra.signup 에 저장되는 값 */
export type SignupSource = Partial<FirstVisit> & { answer?: string };

const clip = (s: string, n: number) => s.trim().slice(0, n);

/** 처음 들어온 요청에서 첫 방문 정보를 만든다. 우리 사이트 안에서 넘어온 경우 ref 는 비운다. */
export function buildFirstVisit(url: URL, referer: string | null, host: string): FirstVisit {
  let ref = "";
  if (referer) {
    try {
      const r = new URL(referer);
      const rh = r.hostname.toLowerCase().replace(/^www\./, "");
      if (rh !== host.replace(/^www\./, "").split(":")[0]) ref = clip(referer, 200);
    } catch {
      /* 이상한 값은 무시 */
    }
  }
  const sp = url.searchParams;
  const campaign = sp.get("utm_campaign") || "";
  const src = sp.get("from") || sp.get("utm_source") || "";
  const from = clip(src && campaign ? `${src}/${campaign}` : src, 60);
  return { ref, landing: clip(url.pathname, 100), from, at: new Date().toISOString() };
}

// 쿠키 값의 인코딩/디코딩은 Next 가 해준다(res.cookies.set / req.cookies.get).
export function encodeFirstVisit(v: FirstVisit): string {
  return JSON.stringify(v);
}

export function decodeFirstVisit(raw: string | undefined): FirstVisit | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw);
    if (!o || typeof o !== "object") return null;
    const s = (k: string, n: number) => (typeof o[k] === "string" ? clip(o[k], n) : "");
    return { ref: s("ref", 200), landing: s("landing", 100), from: s("from", 60), at: s("at", 40) };
  } catch {
    return null;
  }
}

/** User.extra 에서 가입 경로를 꺼낸다(없으면 null — 기능 도입 전 가입자 등). */
export function readSignupSource(extra: unknown): SignupSource | null {
  if (!extra || typeof extra !== "object") return null;
  const s = (extra as Record<string, unknown>).signup;
  return s && typeof s === "object" ? (s as SignupSource) : null;
}

// 자주 오는 사이트는 한글 이름으로
const SITE_NAMES: [RegExp, string][] = [
  [/(^|\.)search\.naver\.com$/, "네이버 검색"],
  [/(^|\.)blog\.naver\.com$/, "네이버 블로그"],
  [/(^|\.)cafe\.naver\.com$/, "네이버 카페"],
  [/(^|\.)naver\.com$/, "네이버"],
  [/(^|\.)google\.[a-z.]+$/, "구글"],
  [/(^|\.)daum\.net$/, "다음"],
  [/(^|\.)tistory\.com$/, "티스토리"],
  [/(^|\.)bing\.com$/, "빙"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "유튜브"],
  [/(^|\.)(kakao\.com|kakaocdn\.net)$/, "카카오"],
  [/(^|\.)instagram\.com$/, "인스타그램"],
  [/(^|\.)(facebook\.com|fb\.com)$/, "페이스북"],
  [/(^|\.)(t\.co|twitter\.com|x\.com)$/, "X(트위터)"],
  [/(^|\.)(t\.me|telegram\.org)$/, "텔레그램"],
];

/** 직전 사이트를 사람이 읽기 쉬운 이름으로. 없으면 "바로 접속". */
export function refLabel(ref: string | undefined): string {
  if (!ref) return "바로 접속";
  try {
    const h = new URL(ref).hostname.toLowerCase().replace(/^www\./, "");
    return SITE_NAMES.find(([re]) => re.test(h))?.[1] ?? h;
  } catch {
    return ref;
  }
}

/** 목록용 짧은 표시 — 링크 표시가 있으면 그걸 앞세운다. 기록이 없으면 "-". */
export function sourceLabel(s: SignupSource | null): string {
  if (!s) return "-";
  if (s.from) return `링크:${s.from}`;
  if (s.ref === undefined && !s.landing) return "-"; // 쿠키 없이 가입(쿠키 차단 등)
  return refLabel(s.ref);
}
