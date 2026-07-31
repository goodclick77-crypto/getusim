import "server-only";

/**
 * "번호 없음"이 확인된 (국가, 서비스) 조합을 잠시 기억해 목록·추천에서 제외한다.
 *
 * 왜 필요한가 — 5sim 가격표의 재고(count)가 실제 구매 가능 여부와 맞지 않는다.
 * 재고 36,600개로 표시되는 조합을 연속 3회 사봤지만 전부 "no free phones" 였다.
 * 특히 재고가 수백만 개로 비정상적으로 큰 조합이 그렇다(실측: 리투아니아/텔레그램,
 * 리투아니아/왓츠앱 855만, 덴마크/페이스북 835만 — 전부 구매 불가).
 *
 * 더 나쁜 건 그런 조합일수록 실제 판매 표본이 적어 수신률(rate)이 비현실적으로 높게 잡히고,
 * 그래서 목록 맨 위·스마트 추천으로 올라온다는 점이다. 회원은 제일 잘 받아진다고 표시된 걸
 * 눌러서 계속 실패한다.
 *
 * 5sim이 주는 데이터만으로는 걸러낼 방법이 없다 — 실제로 사보는 것 외에는. 그래서 한 번
 * 부딪힌 결과를 여기 쌓아 다음 회원은 안 겪게 한다.
 *
 * 저장은 프로세스 메모리다(환율 캐시와 동일한 방식). 재시작하면 비지만, 어차피 재고 상황은
 * 계속 변하므로 영구 보관할 값이 아니다.
 */

const TTL = Number(process.env.SMS_UNAVAILABLE_TTL_MS || 10 * 60 * 1000);

/** key = `${country}:${service}` → 제외 만료 시각(ms) */
const until = new Map<string, number>();

function keyOf(country: string, service: string) {
  return `${country}:${service}`;
}

/**
 * 5sim 응답이 "이 조합에 번호가 없다"는 뜻인지 판별.
 * ★ 잔액 부족·rating 부족·인증 오류까지 싸잡아 제외하면 안 된다 — 그건 계정 전체 문제라
 *   모든 국가가 목록에서 사라져 사이트가 통째로 비어버린다.
 */
export function meansNoPhones(message: string): boolean {
  const m = (message || "").toLowerCase();
  return m.includes("no free phones") || m.includes("no product");
}

/** 구매 실패(번호 없음)로 확인된 조합을 제외 목록에 올린다. */
export function markUnavailable(country: string, service: string) {
  // 만료된 항목이 쌓이지 않게 가끔 청소(국가×서비스 조합이라 상한이 있지만 안전하게)
  if (until.size > 500) {
    const now = Date.now();
    for (const [k, t] of until) if (t <= now) until.delete(k);
  }
  until.set(keyOf(country, service), Date.now() + TTL);
}

/** 지금 제외 대상인가 */
export function isUnavailable(country: string, service: string): boolean {
  const k = keyOf(country, service);
  const t = until.get(k);
  if (!t) return false;
  if (t <= Date.now()) {
    until.delete(k);
    return false;
  }
  return true;
}
