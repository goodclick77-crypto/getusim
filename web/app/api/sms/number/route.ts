import { NextResponse } from "next/server";
import { getCurrentUser, touchLastSeen } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { fivesim, FiveSimError } from "@/lib/fivesim";
import { getUsdKrw } from "@/lib/fx";
import { notifyAdmin } from "@/lib/notify";
import { countryLabel, serviceLabel } from "@/lib/config";
import {
  COUNTRIES,
  SERVICES,
  SMS_MIN_POINT,
  FIVESIM_MAX_PRICE,
  FIVESIM_MIN_STOCK,
  smsPointPrice,
} from "@/lib/config";

// 예상치 못한 오류(공급사 비-JSON 응답 / 네트워크 / DB 등)일 때 사용자에게 보여줄 중립 안내.
// ⚠️ 공급사(5sim 등) 정보는 절대 노출하지 않는다. 실제 원인은 서버 로그로만 남긴다.
const GENERIC_FAIL = "일시적인 문제로 발급이 불가능합니다. 다른 국가·서비스를 이용해주세요.";

// 번호 발급(무료). 동적 가격: 원가에 따라 차감 포인트가 달라짐(수신 성공 시 차감).
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });

    // 세션만으로 발급하는 활동 사용자도 로그인 현황에 잡히도록 접속시각 갱신(스로틀됨)
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim();
    await touchLastSeen(user.id, ip);

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
      // 번호 없음 / 공급사 비-JSON 응답 등 → 사용자에겐 "번호 없음"으로만 안내(공급사 비노출).
      // 실제 응답 내용은 원인 파악용으로 서버 로그에만 남긴다.
      if (e instanceof FiveSimError) {
        console.error("[sms/number] 구매 실패:", e.status, e.message);
        return NextResponse.json({ error: "00" });
      }
      throw e; // 네트워크 등 예상 밖 → 아래 상위 catch에서 중립 메시지 + 로깅
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

    let rental;
    try {
      rental = await prisma.numberRental.create({
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
          // 5sim이 만료시간을 안 주면 15분 후로 기본 설정(이어받기/만료처리 위해 null 금지)
          expiresAt: order.expires ? new Date(order.expires) : new Date(Date.now() + 15 * 60 * 1000),
        },
      });
    } catch (e) {
      // DB 저장 실패 → 산 번호를 취소해 원가 손실 방지
      try {
        await fivesim.cancel(order.id);
      } catch {}
      throw e;
    }

    await notifyAdmin(
      "order",
      `번호 주문 ${countryLabel(country)}/${serviceLabel(service)}`,
      `회원: ${user.name || user.loginId}\n국가/서비스: ${countryLabel(country)} / ${serviceLabel(service)}\n번호: ${order.phone}\n차감예정: ${pricePoint.toLocaleString("ko-KR")}P`,
    );

    return NextResponse.json({
      rentalId: rental.id,
      phone: order.phone,
      expires: rental.expiresAt,
      pricePoint,
    });
  } catch (e) {
    // 처리되지 않은 예외(네트워크/DB 등)는 흰 화면 500 대신 중립 메시지로.
    // 실제 원인은 공급사 노출 없이 서버 로그에만 남긴다.
    console.error("[sms/number] 발급 실패:", e);
    return NextResponse.json({ message: GENERIC_FAIL });
  }
}
