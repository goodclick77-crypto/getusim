import { prisma } from "./prisma";

// 속도제한 카운터(고정 창). Postgres 에 보관해 재배포·재시작·다중 인스턴스에서도 유지된다.
//   · 테이블은 처음 쓸 때 만든다 — main 은 마이그레이션 SQL 을 저장소에 두지 않아 배포 시 자동 생성이 안 됨.
//   · DB 가 실패하면 서비스가 막히지 않게 아래 인메모리 카운터로 대체한다.

let ready: Promise<unknown> | null = null;
function ensureTable() {
  ready ??= prisma
    .$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS rate_limit (
         key      text PRIMARY KEY,
         count    integer NOT NULL,
         reset_at timestamptz NOT NULL
       )`,
    )
    .catch((e) => {
      ready = null;
      throw e;
    });
  return ready;
}

// 만료된 행 정리(10분에 한 번, 응답을 기다리게 하지 않음)
let lastDbSweep = 0;
function sweepDb() {
  const now = Date.now();
  if (now - lastDbSweep < 10 * 60_000) return;
  lastDbSweep = now;
  prisma.$executeRaw`DELETE FROM rate_limit WHERE reset_at < now()`.catch(() => {});
}

/** key가 windowMs 동안 limit회 이내면 true(허용), 초과면 false(차단). */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  try {
    await ensureTable();
    const rows = await prisma.$queryRaw<{ count: number }[]>`
      INSERT INTO rate_limit (key, count, reset_at)
      VALUES (${key}, 1, now() + ${windowMs}::bigint * interval '1 millisecond')
      ON CONFLICT (key) DO UPDATE SET
        count    = CASE WHEN rate_limit.reset_at <= now() THEN 1 ELSE rate_limit.count + 1 END,
        reset_at = CASE WHEN rate_limit.reset_at <= now() THEN EXCLUDED.reset_at ELSE rate_limit.reset_at END
      RETURNING count`;
    sweepDb();
    return rows[0].count <= limit;
  } catch (e) {
    console.error("[ratelimit] DB 카운터 실패 → 메모리 카운터로 대체:", e);
    return rateLimitLocal(key, limit, windowMs);
  }
}

// 인메모리 슬라이딩 윈도우. DB 장애 시 대체용 + 차단 로그 도배 방지처럼 정확도가 중요하지 않은 곳에 쓴다.
const hits = new Map<string, number[]>();
let lastSweep = 0;

export function rateLimitLocal(key: string, limit: number, windowMs: number): boolean {
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
 *  Railway 는 X-Forwarded-For 끝에 "<실제 클라이언트 IP>, <Railway 엣지 IP(152.233.x.x 등)>" 를 붙인다.
 *    · 맨 왼쪽 값은 클라이언트가 마음대로 넣을 수 있어(속도제한 우회) 쓰면 안 되고,
 *    · 맨 끝은 엣지 서버 IP 라 전 회원이 몇 개 카운터를 나눠 쓰게 된다(2026-10 운영에서 확인).
 *  → 끝에서 두 번째(엣지가 붙인 실제 클라이언트 IP)를 쓴다. */
const TRUSTED_PROXY_HOPS = 1;
export function ipFromHeaders(h: Headers): string {
  const parts = (h.get("x-forwarded-for") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const i = Math.max(0, parts.length - 1 - TRUSTED_PROXY_HOPS);
  return parts[i] || h.get("x-real-ip") || "unknown";
}

/** 요청에서 클라이언트 IP 추출 */
export function clientIp(req: Request): string {
  return ipFromHeaders(req.headers);
}
