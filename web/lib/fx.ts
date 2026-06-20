import "server-only";
import { SMS_USD_TO_KRW } from "./config";

// USD→KRW 실시간 환율 (1시간 캐시, 실패 시 기본값/직전값 유지)
let rate = SMS_USD_TO_KRW;
let fetchedAt = 0;
const TTL = 60 * 60 * 1000;

export async function getUsdKrw(): Promise<number> {
  if (fetchedAt && Date.now() - fetchedAt < TTL) return rate;
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      cache: "no-store",
    });
    const j = await res.json();
    const krw = Number(j?.rates?.KRW);
    if (j?.result === "success" && krw > 0) rate = Math.round(krw);
  } catch {
    // 네트워크 실패 → 직전값/기본값 유지
  }
  fetchedAt = Date.now();
  return rate;
}
