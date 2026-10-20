import { NextResponse } from "next/server";
import { getCurrentUser, touchLastSeen } from "@/lib/session";
import { clientIp, rateLimit, rateLimitLocal } from "@/lib/ratelimit";
import { prisma } from "@/lib/prisma";
import { fivesim, FiveSimError } from "@/lib/fivesim";
import { getUsdKrw } from "@/lib/fx";
import { notifyAdmin, notifyUrgent } from "@/lib/notify";
import { markUnavailable, meansNoPhones } from "@/lib/unavailable";
import { countryLabel, serviceLabel } from "@/lib/config";
import {
  COUNTRIES,
  SERVICES,
  SMS_MIN_POINT,
  SMS_MARKUP,
  SMS_FREE_THRESHOLD_USD,
  FIVESIM_MAX_PRICE,
  FIVESIM_MIN_STOCK,
  SMS_WAIT_MS,
  smsPointPrice,
} from "@/lib/config";

// 5sim 계정은 전 회원이 같이 쓴다 — 한 회원이 연달아 받고 취소하면 5sim 쪽 계정 점수(rating)가
// 깎이거나 요청이 막혀 모든 회원의 발급이 멈출 수 있다. 그래서 회원별로 횟수·동시 진행을 제한한다.
const NUMBER_PER_MIN = 3;
const BUSY_MSG =
  "인증코드를 기다리는 중인 번호가 있어요. 코드가 오거나 '밴넘버'를 누른 뒤 새 번호를 받을 수 있어요. (3분이 지나면 자동 취소돼요)";

// 코드 대기 중(3분 이내)인 미수신 발급건 조건. 3분이 지나면 스케줄러가 밴·정리한다.
function waitingWhere(userId: number) {
  return {
    userId,
    status: "PENDING" as const,
    expiresAt: { gt: new Date() },
    createdAt: { gt: new Date(Date.now() - SMS_WAIT_MS) },
  };
}

// 예상치 못한 오류(공급사 비-JSON 응답 / 네트워크 / DB 등)일 때 사용자에게 보여줄 중립 안내.
// ⚠️ 공급사(5sim 등) 정보는 절대 노출하지 않는다. 실제 원인은 서버 로그로만 남긴다.
const GENERIC_FAIL = "일시적인 문제로 발급이 불가능합니다. 다른 국가·서비스를 이용해주세요.";

// 번호 발급(무료). 동적 가격: 원가에 따라 차감 포인트가 달라짐(수신 성공 시 차감).
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });

    // 세션만으로 발급하는 활동 사용자도 로그인 현황에 잡히도록 접속시각 갱신(스로틀됨)
    const ip = clientIp(req);
    await touchLastSeen(user.id, ip);

    // maxPoint = 회원 화면에 표시됐던 차감 예정 포인트. 있으면 그 금액을 상한으로 쓴다.
    const { country, service, maxPoint } = await req.json().catch(() => ({}));
    if (
      !COUNTRIES.some((c) => c.value === country) ||
      !SERVICES.some((s) => s.value === service)
    ) {
      return NextResponse.json({ error: "국가와 서비스를 선택하세요" }, { status: 400 });
    }

    // 동시 발급 금지 — 코드 대기 중인 번호가 있으면 새로 받지 않는다.
    if (await prisma.numberRental.count({ where: waitingWhere(user.id) })) {
      return NextResponse.json({ error: "busy", message: BUSY_MSG });
    }
    // 1분에 3번까지. 넘으면 5sim 에는 요청 자체를 보내지 않는다.
    if (!(await rateLimit(`sms-number:${user.id}`, NUMBER_PER_MIN, 60_000))) {
      return NextResponse.json({
        error: "rate",
        message: `번호 받기는 1분에 ${NUMBER_PER_MIN}번까지 가능합니다. 잠시 후 다시 시도해 주세요.`,
      });
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

    // 회원이 화면에서 본 금액(maxPoint)을 구매 상한으로 환산한다.
    // smsPointPrice()의 역함수: point = usd × fx × SMS_MARKUP → usd = point / (fx × SMS_MARKUP).
    // 정액구간(≤$0.3 는 무조건 1,000P) 때문에 하한을 SMS_FREE_THRESHOLD_USD 로 잡아야
    // 1,000P 짜리 번호가 상한에 걸려 안 팔리는 일이 없다.
    const cap = Number(maxPoint) > 0 ? Number(maxPoint) : 0;
    const maxUsd = cap
      ? Math.min(FIVESIM_MAX_PRICE, Math.max(SMS_FREE_THRESHOLD_USD, cap / (fx * SMS_MARKUP)))
      : FIVESIM_MAX_PRICE;

    // 번호 구매 — maxPrice 를 넘겨 5sim 쪽에서 비싼 번호를 아예 팔지 않게 한다(사고-취소 왕복 제거).
    let order;
    try {
      order = await fivesim.buyActivation(country, operator, service, maxUsd);
    } catch (e) {
      // 번호 없음 / 공급사 비-JSON 응답 등 → 사용자에겐 "번호 없음"으로만 안내(공급사 비노출).
      // 실제 응답 내용은 원인 파악용으로 서버 로그에만 남긴다.
      if (e instanceof FiveSimError) {
        console.error("[sms/number] 구매 실패:", country, service, e.status, e.message);
        // "번호 없음"이면 이 조합을 잠시 목록·추천에서 뺀다(5sim 재고 표시를 못 믿는다).
        // 잔액·rating 같은 계정 전체 문제까지 제외해버리면 전 국가가 사라지므로 메시지를 가려서 본다.
        if (meansNoPhones(e.message)) {
          markUnavailable(country, service);
          return NextResponse.json({ error: "00" });
        }
        // 번호 없음이 아닌 실패(점수 부족·요청 과다·잔액 부족·인증 오류 등)는 계정 전체 문제일 수 있어
        // 관리자에게 바로 알린다(같은 오류는 10분에 한 번만). 회원에겐 다른 국가를 골라도 소용없으니
        // "번호 없음" 대신 잠시 후 재시도 안내를 보여준다.
        if (rateLimitLocal(`fivesim-alert:${e.status}:${e.message.slice(0, 40)}`, 1, 10 * 60_000)) {
          await notifyUrgent(
            "5sim 번호 구매 실패",
            `국가/서비스: ${countryLabel(country)} / ${serviceLabel(service)}\n회원: ${user.name || user.loginId}\n상태코드: ${e.status}\n응답: ${e.message.slice(0, 500)}`,
          );
        }
        return NextResponse.json({
          error: "down",
          message: "일시적인 문제로 발급이 잠시 중단되었습니다. 잠시 후 다시 시도해 주세요.",
        });
      }
      throw e; // 네트워크 등 예상 밖 → 아래 상위 catch에서 중립 메시지 + 로깅
    }
    if (!order?.phone || (order.price != null && order.price > FIVESIM_MAX_PRICE)) {
      // 여기도 사용자에겐 "번호 없음"이지만 원인이 전혀 달라(응답에 번호가 없음 / 단가 초과)
      // 로그가 없으면 구매 실패와 구분이 안 된다.
      console.error(
        "[sms/number] 구매 응답 부적합:",
        country,
        service,
        `phone=${order?.phone ?? "none"} price=${order?.price ?? "none"}`,
      );
      markUnavailable(country, service); // 번호를 못 받은 건 마찬가지 → 잠시 제외
      if (order?.id) {
        try {
          await fivesim.cancel(order.id);
        } catch {}
      }
      return NextResponse.json({ error: "00" });
    }

    // 실제 차감 포인트
    const pricePoint = smsPointPrice(order.price, fx);

    // 조회~발급 사이 5sim 가격이 올라 회원이 본 금액을 넘긴 경우 — 사지 않고 되돌린다.
    // (maxPrice 로 대부분 걸러지지만 정액구간 하한 때문에 통과할 수 있어 여기서 한 번 더 막는다.)
    if (cap && pricePoint > cap) {
      try {
        await fivesim.cancel(order.id);
      } catch {}
      console.error("[sms/number] 표시가격 초과:", country, service, `${pricePoint}P > ${cap}P`);
      return NextResponse.json({
        message: `가격이 변동되었습니다 (${pricePoint.toLocaleString("ko-KR")}P). 다시 시도해 주세요.`,
      });
    }

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

    // 동시 요청이 모두 위의 (오래된) 예약 합계를 보고 통과할 수 있으므로,
    // 회원 단위 잠금 안에서 잔액·예약을 다시 계산한 뒤 저장한다. 초과분은 산 번호를 취소.
    let rental;
    try {
      rental = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${user.id})`;
        // 동시에 들어온 요청이 둘 다 위의 검사를 통과했을 수 있다 → 잠금 안에서 한 번 더 확인.
        if (await tx.numberRental.count({ where: waitingWhere(user.id) })) return "busy" as const;
        const fresh = await tx.user.findUnique({ where: { id: user.id }, select: { point: true } });
        const agg = await tx.numberRental.aggregate({
          where: { userId: user.id, status: "PENDING", expiresAt: { gt: new Date() } },
          _sum: { pricePoint: true },
        });
        if ((fresh?.point ?? 0) - (agg._sum.pricePoint ?? 0) < pricePoint) return null;
        return tx.numberRental.create({
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
      });
    } catch (e) {
      // DB 저장 실패 → 산 번호를 취소해 원가 손실 방지
      try {
        await fivesim.cancel(order.id);
      } catch {}
      throw e;
    }
    if (rental === "busy") {
      try {
        await fivesim.cancel(order.id);
      } catch {}
      return NextResponse.json({ error: "busy", message: BUSY_MSG });
    }
    if (!rental) {
      try {
        await fivesim.cancel(order.id);
      } catch {}
      return NextResponse.json({
        error: "need",
        needPoint: pricePoint,
        message: "진행중인 번호에 포인트가 예약되어 있어 추가 발급할 수 없습니다. 진행중 번호를 먼저 마무리해주세요.",
      });
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
