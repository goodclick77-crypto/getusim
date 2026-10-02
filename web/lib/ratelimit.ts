// 아주 단순한 인메모리 IP 레이트리밋(슬라이딩 윈도우).
// Railway 단일 인스턴스 기준 충분. 재배포 시 초기화되는 점은 감수.
const hits = new Map<string, number[]>();
let lastSweep = 0;

/** key가 windowMs 동안 limit회 이내면 true(허용), 초과면 false(차단). */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();

  // 가끔 오래된 키 정리(메모리 누수 방지)
  if (now - lastSweep > 60_000) {
    lastSweep = now;
    for (const [k, arr] of hits) {
      const live = arr.filter((t) => now - t < windowMs);
      if (live.length === 0) hits.delete(k);
      else hits.set(k, live);
    }
  }

  const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(key, arr);
  return arr.length <= limit;
}

/** 헤더에서 클라이언트 IP 추출.
 *  X-Forwarded-For 의 왼쪽 값은 클라이언트가 마음대로 넣을 수 있어(속도제한 우회) 쓰지 않는다.
 *  Railway 엣지 프록시가 맨 뒤에 붙이는 값(신뢰 프록시 1홉)만 사용. */
export function ipFromHeaders(h: Headers): string {
  const parts = (h.get("x-forwarded-for") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return parts[parts.length - 1] || h.get("x-real-ip") || "unknown";
}

/** 요청에서 클라이언트 IP 추출 */
export function clientIp(req: Request): string {
  return ipFromHeaders(req.headers);
}
