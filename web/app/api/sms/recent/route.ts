import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { COUNTRIES, SERVICES } from "@/lib/config";

/** 최근 성공 이력 조회 기간. 너무 짧으면 성공 이력이 있어도 못 잡아 수신률 폴백으로 빠진다. */
const WINDOW_MS = 72 * 60 * 60 * 1000;
/** 참고용으로 보여줄 국가 수 */
const MAX_COUNTRIES = 2;

// 서비스 선택 시 "최근 수신 성공한 국가" (참고용). 회원 전체 기준 최근 72시간.
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ countries: [] }, { status: 401 });

  const service = new URL(req.url).searchParams.get("service") || "";
  if (!SERVICES.some((s) => s.value === service)) {
    return NextResponse.json({ countries: [] });
  }

  let rows: { country: string; createdAt: Date }[] = [];
  try {
    rows = await prisma.numberRental.findMany({
      where: {
        service,
        status: { in: ["RECEIVED", "FINISHED"] },
        createdAt: { gte: new Date(Date.now() - WINDOW_MS) },
      },
      select: { country: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 100, // 중복 제거는 아래에서 — distinct+take 조합의 순서 문제를 피함
    });
  } catch {
    return NextResponse.json({ countries: [] }); // 참고 정보이므로 실패해도 화면은 진행
  }

  // 최근순을 유지하며 국가 중복 제거. 수신 시각은 내보내지 않는다(화면에 표시하지 않음).
  const seen = new Set<string>();
  const countries: { value: string; label: string; iso: string }[] = [];
  for (const r of rows) {
    if (seen.has(r.country)) continue;
    const c = COUNTRIES.find((x) => x.value === r.country);
    if (!c) continue; // 목록에서 빠진 국가는 선택할 수 없으므로 제외
    seen.add(r.country);
    countries.push({ value: c.value, label: c.label, iso: c.iso });
    if (countries.length === MAX_COUNTRIES) break;
  }

  return NextResponse.json({ countries });
}
