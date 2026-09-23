import "server-only";
import { prisma } from "./prisma";

/**
 * 겟유심 자체 발급 이력으로 계산한 (국가, 서비스)별 실제 성공률.
 *
 * 5sim이 주는 수신률은 전 세계 사용자 통계라 한국 사용자가 한국 서비스에 쓰는 패턴과 다르다.
 * 우리 DB의 NumberRental 에는 국가·서비스·결과가 전부 남으므로, 최근 기간 동안
 * "코드가 실제로 도착한 비율"을 직접 계산해 목록에 같이 보여준다.
 *
 * 성공 = RECEIVED / FINISHED (코드 도착). 실패 = CANCELED(밴) / EXPIRED(시간 초과).
 * PENDING(진행 중)은 결과가 아직 없으므로 제외한다.
 *
 * 표본이 적으면 숫자가 요동치므로 화면에서는 MIN_SAMPLE 미만이면 표시하지 않는다.
 * 결과는 프로세스 메모리에 잠시 캐시한다(환율 캐시와 같은 방식) — 목록 조회마다
 * 수천 행을 다시 세지 않기 위해서다.
 */

const WINDOW_DAYS = Number(process.env.SUCCESS_RATE_WINDOW_DAYS || 7);
const CACHE_MS = Number(process.env.SUCCESS_RATE_CACHE_MS || 60 * 1000);
/** 이 건수 미만이면 "표본 부족"으로 보고 화면에 성공률을 내보내지 않는다. */
export const SUCCESS_RATE_MIN_SAMPLE = Number(process.env.SUCCESS_RATE_MIN_SAMPLE || 3);

export type SuccessStat = { rate: number; n: number };

let cache: { at: number; map: Map<string, SuccessStat> } | null = null;

function keyOf(country: string, service: string) {
  return `${country}:${service}`;
}

async function load(): Promise<Map<string, SuccessStat>> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_MS) return cache.map;

  const since = new Date(now - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const rows = await prisma.numberRental.groupBy({
    by: ["country", "service", "status"],
    where: {
      createdAt: { gte: since },
      status: { in: ["RECEIVED", "FINISHED", "CANCELED", "EXPIRED"] },
    },
    _count: { _all: true },
  });

  const acc = new Map<string, { ok: number; total: number }>();
  for (const r of rows) {
    const k = keyOf(r.country, r.service);
    const cur = acc.get(k) ?? { ok: 0, total: 0 };
    const n = r._count._all;
    cur.total += n;
    if (r.status === "RECEIVED" || r.status === "FINISHED") cur.ok += n;
    acc.set(k, cur);
  }

  const map = new Map<string, SuccessStat>();
  for (const [k, v] of acc) {
    map.set(k, { rate: v.total ? Math.round((v.ok / v.total) * 100) : 0, n: v.total });
  }
  cache = { at: now, map };
  return map;
}

/**
 * (국가, 서비스) 조합의 실측 성공률. 표본이 MIN_SAMPLE 미만이거나 조회 실패 시 null.
 * 목록 조회 전에 한 번 `loadSuccessStats()`로 맵을 받아 여러 조합에 재사용한다.
 */
export async function loadSuccessStats(): Promise<Map<string, SuccessStat>> {
  try {
    return await load();
  } catch (e) {
    console.error("[success-rate] 조회 실패:", e);
    return new Map(); // 참고 정보이므로 실패해도 목록은 진행
  }
}

export function pickSuccessStat(
  map: Map<string, SuccessStat>,
  country: string,
  service: string,
): SuccessStat | null {
  const s = map.get(keyOf(country, service));
  if (!s || s.n < SUCCESS_RATE_MIN_SAMPLE) return null;
  return s;
}
