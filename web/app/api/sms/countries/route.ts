import { NextResponse } from "next/server";
import { listCountryOffers } from "@/lib/catalog";

// 서비스 선택 시 잘 받아지는 국가 비교 (가격은 공개 정보 → 비회원도 조회 가능)
// 계산은 lib/catalog.ts 에 있고 상품 상세 페이지(/products/[service])와 공유한다.
export async function GET(req: Request) {
  const service = new URL(req.url).searchParams.get("service") || "";
  const countries = await listCountryOffers(service);
  return NextResponse.json({ countries });
}
