import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { fivesim, FiveSimError } from "@/lib/fivesim";
import { getUsdKrw } from "@/lib/fx";
import {
  COUNTRIES,
  SERVICES,
  SMS_MIN_POINT,
  FIVESIM_MAX_PRICE,
  FIVESIM_MIN_STOCK,
  smsPointPrice,
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
    return NextResponse.json({
      error: "need",
      needPoint: SMS_MIN_POINT,
      message: `포인트가 부족합니다 (최소 ${SMS_MIN_POINT.toLocaleString("ko-KR")}P 필요, 보유 ${user.point.toLocaleString("ko-KR")}P)`,
    });
  }

  // 아직 코드 미수신(차감 전)인 진행중 번호들의 예약 포인트 합계.
  // 동시 발급으로 보유보다 많이 받아 무료수신(원가손실)되는 것을 방지.
  const pendingAgg = await prisma.numberRental.aggregate({
    where: { userId: user.id, status: "PENDING", expiresAt: { gt: new Date() } },
    _sum: { pricePoint: true },
  });
  const reserved = pendingAgg._sum.pricePoint ?? 0;
  const available = user.point - reserved;

  // 최저가 통신사 선택
  const fx = await getUsdKrw();

  // 최저가 통신사 + 예상 가격
  let operator = "any";
  let estPrice = 0;
  try {
    const pick = await fivesim.bestOperator(country, service, FIVESIM_MAX_PRICE, FIVESIM_MIN_STOCK);
    if (pick) {
      operator = pick.operator;
      estPrice = smsPointPrice(pick.cost, fx);
    }
  } catch {
    /* 가격표 실패 → any */
  }

  // ★ 발급 전에 미리 차단 — 부족하면 구매 자체를 하지 않음 (진행중 번호 예약분 차감)
  const needAmount = Math.max(estPrice, SMS_MIN_POINT);
  if (available < needAmount) {
    const msg =
      reserved > 0
        ? `포인트가 부족합니다 (필요 ${needAmount.toLocaleString("ko-KR")}P, 사용가능 ${available.toLocaleString("ko-KR")}P · 진행중 번호 ${reserved.toLocaleString("ko-KR")}P 예약중)`
        : `이 서비스는 ${needAmount.toLocaleString("ko-KR")}P가 필요합니다 (보유 ${user.point.toLocaleString("ko-KR")}P)`;
    return NextResponse.json({ error: "need", needPoint: needAmount, message: msg });
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

  // 실제 차감 포인트
  const pricePoint = smsPointPrice(order.price, fx);

  // 안전망: 조회 후 가격이 급변해 사용가능 포인트보다 커진 드문 경우만 취소
  if (available < pricePoint) {
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
      costKrw: Math.round((order.price || 0) * fx),
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
