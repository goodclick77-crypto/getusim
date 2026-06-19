import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { fivesim, FiveSimError } from "@/lib/fivesim";
import {
  COUNTRIES,
  SERVICES,
  SMS_MIN_POINT,
  SMS_COST_POINT,
  FIVESIM_MAX_PRICE,
  FIVESIM_MIN_STOCK,
} from "@/lib/config";

// 번호 발급 (무료). 재고/단가 조건 통신사 자동선택 후 5sim 구매.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });

  const { country, service } = await req.json().catch(() => ({}));
  if (
    !COUNTRIES.some((c) => c.value === country) ||
    !SERVICES.some((s) => s.value === service)
  ) {
    return NextResponse.json({ error: "국가와 서비스를 선택하세요" }, { status: 400 });
  }
  if (user.point < SMS_MIN_POINT) {
    return NextResponse.json({ error: "포인트가 부족합니다" }, { status: 400 });
  }

  let operator = "any";
  try {
    operator = await fivesim.pickOperator(
      country,
      service,
      FIVESIM_MAX_PRICE,
      FIVESIM_MIN_STOCK,
    );
  } catch {
    /* 가격표 조회 실패 시 any 로 진행 */
  }

  let order;
  try {
    order = await fivesim.buyActivation(country, operator, service);
  } catch (e) {
    if (e instanceof FiveSimError) return NextResponse.json({ error: "00" });
    throw e;
  }

  // 번호 없음 / 단가 초과 → 취소 후 "00"
  if (!order?.phone || (order.price != null && order.price > FIVESIM_MAX_PRICE)) {
    if (order?.id) {
      try {
        await fivesim.cancel(order.id);
      } catch {}
    }
    return NextResponse.json({ error: "00" });
  }

  const rental = await prisma.numberRental.create({
    data: {
      userId: user.id,
      provider: "5sim",
      fivesimId: String(order.id),
      country,
      operator,
      service,
      phoneNumber: order.phone,
      pricePoint: SMS_COST_POINT,
      status: "PENDING",
      expiresAt: order.expires ? new Date(order.expires) : null,
    },
  });

  return NextResponse.json({
    rentalId: rental.id,
    phone: order.phone,
    expires: rental.expiresAt,
  });
}
