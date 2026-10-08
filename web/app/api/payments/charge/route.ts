import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getPaymentProvider } from "@/lib/payments";
import { completeCharge } from "@/lib/charge";
import { notifyAdmin } from "@/lib/notify";
import { rateLimit } from "@/lib/ratelimit";
import { chargeAmount, CHARGE_MIN_POINT, CHARGE_MAX_POINT } from "@/lib/config";

/**
 * 카드·간편결제로 잔액 충전(결제창 방식).
 * 결제창이 돌려준 결제키(token)로 서버 최종 승인(confirm) → 충전 주문 기록 → 잔액 즉시 지급.
 * 승인 후 기록·지급이 어떤 이유로든 실패하면 승인을 바로 취소해 "돈은 나갔는데 잔액이 없는" 상태를 막는다.
 * 금액은 클라이언트가 보낸 금액이 아니라 point 로 서버가 다시 계산한다(결제창 표시가와 같은 식).
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  if (!(await rateLimit(`pay-charge:${user.id}`, 10, 60_000))) {
    return NextResponse.json({ error: "잠시 후 다시 시도해 주세요." }, { status: 429 });
  }

  const provider = getPaymentProvider();
  if (!provider.isConfigured()) {
    return NextResponse.json({ error: "카드 결제가 아직 준비되지 않았습니다." });
  }

  const { point, token, orderId } = await req.json().catch(() => ({}));
  if (
    !Number.isInteger(point) ||
    point < CHARGE_MIN_POINT ||
    point > CHARGE_MAX_POINT ||
    point % 1000 !== 0
  ) {
    return NextResponse.json({ error: "충전 금액이 올바르지 않습니다." }, { status: 400 });
  }
  if (typeof token !== "string" || !token || typeof orderId !== "string" || !/^C[0-9A-Za-z-]{8,60}$/.test(orderId)) {
    return NextResponse.json({ error: "결제 정보가 없습니다. 다시 결제해 주세요." }, { status: 400 });
  }

  const amount = chargeAmount(point);
  let txId: string;
  try {
    const r = await provider.confirm({ token, orderId, amount, customerId: `U${user.id}` });
    txId = r.txId;
  } catch (e) {
    console.error("[payments/charge] 승인 실패:", e);
    return NextResponse.json({ error: "결제 승인에 실패했습니다. 다시 시도해 주세요." });
  }

  let orderRowId: number | null = null;
  try {
    const order = await prisma.chargeOrder.create({
      data: {
        userId: user.id,
        amount,
        chargePoint: point,
        method: "CARD",
        status: "PENDING",
        pg: provider.name,
        pgTno: txId,
        legacyData: { orderId },
      },
    });
    orderRowId = order.id;
    const ok = await completeCharge(order.id, amount, true);
    if (!ok) throw new Error(`completeCharge 가 false 를 반환 (order #${order.id})`);
  } catch (e) {
    console.error("[payments/charge] 충전 기록 실패 → 승인 취소:", e);
    let canceled = false;
    try {
      await provider.cancel({ txId, reason: "충전 처리 실패" });
      canceled = true;
    } catch (ce) {
      console.error("[payments/charge] 승인 취소도 실패:", ce);
    }
    if (orderRowId) {
      await prisma.chargeOrder
        .updateMany({ where: { id: orderRowId, charged: false }, data: { status: "CANCELED" } })
        .catch(() => {});
    }
    if (!canceled) {
      await notifyAdmin(
        "chargeRequest",
        "카드 충전 승인취소 실패 — 확인 필요",
        `회원: ${user.name || user.loginId}\n금액: ${amount.toLocaleString("ko-KR")}원\n거래번호: ${txId}\n충전 기록에 실패했고 승인 취소도 실패했습니다. PG 관리자에서 직접 취소해 주세요.`,
      ).catch(() => {});
    }
    return NextResponse.json({
      error: canceled
        ? "충전 처리 중 문제가 생겨 결제를 취소했습니다. 다시 시도해 주세요."
        : "충전 처리 중 문제가 생겼습니다. 1:1 문의로 알려주시면 바로 확인해 드립니다.",
    });
  }

  await notifyAdmin(
    "deposit",
    `[카드결제] ${user.name || user.loginId} ${amount.toLocaleString("ko-KR")}원 · ${point.toLocaleString("ko-KR")}P 충전`,
    `회원: ${user.name || "-"} (${user.loginId})
결제 금액: ${amount.toLocaleString("ko-KR")}원
충전 포인트: ${point.toLocaleString("ko-KR")}P
거래번호: ${txId}`,
  ).catch(() => {});

  return NextResponse.json({ ok: true, point, amount });
}
