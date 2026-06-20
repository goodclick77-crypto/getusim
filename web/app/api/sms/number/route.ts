import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { fivesim, FiveSimError } from "@/lib/fivesim";
import {
  COUNTRIES,
  SERVICES,
  SMS_MIN_POINT,
  FIVESIM_MAX_PRICE,
  FIVESIM_MIN_STOCK,
  smsPointPrice,
  SMS_USD_TO_KRW,
} from "@/lib/config";

// 번호 발급(무료). 동적 가격: 원가에 따라 차감 포인트가 달라짐(수신 성공 시 차감).
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

  // 최저가 통신사 선택
  let operator = "any";
  try {
    const pick = await fivesim.bestOperator(country, service, FIVESIM_MAX_PRICE, FIVESIM_MIN_STOCK);
    if (pick) operator = pick.operator;
  } catch {
    /* 가격표 실패 → any */
  }

  // 번호 구매
  let order;
  try {
    order = await fivesim.buyActivation(country, operator, service);
  } catch (e) {
    if (e instanceof FiveSimError) return NextResponse.json({ error: "00" });
    throw e;
  }
  if (!order?.phone || (order.price != null && order.price > FIVESIM_MAX_PRICE)) {
    if (order?.id) {
      try {
        await fivesim.cancel(order.id);
      } catch {}
    }
    return NextResponse.json({ error: "00" });
  }

  // 동적 차감 포인트 (원가 기준)
  const pricePoint = smsPointPrice(order.price);

  // 차감액보다 보유가 적으면 발급 취소(환불)
  if (user.point < pricePoint) {
    try {
      await fivesim.cancel(order.id);
    } catch {}
    return NextResponse.json({
      error: "need",
      needPoint: pricePoint,
      message: `이 서비스는 ${pricePoint.toLocaleString("ko-KR")}P가 필요합니다 (보유 ${user.point.toLocaleString("ko-KR")}P)`,
    });
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
      pricePoint,
      costKrw: Math.round((order.price || 0) * SMS_USD_TO_KRW),
      status: "PENDING",
      expiresAt: order.expires ? new Date(order.expires) : null,
    },
  });

  return NextResponse.json({
    rentalId: rental.id,
    phone: order.phone,
    expires: rental.expiresAt,
    pricePoint,
  });
}
