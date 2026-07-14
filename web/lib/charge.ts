import { prisma } from "./prisma";
import { adjustPoint } from "./points";
import { DEPOSIT_MATCH_WINDOW_DAYS, normDepositName } from "./config";

/**
 * 충전 주문을 완료 처리하고 포인트를 지급한다. (관리자 수동/입금 자동확인 공용)
 * 멱등: 이미 지급(charged)됐거나 취소된 주문이면 아무것도 하지 않고 false 반환.
 * @param auto 입금문자 자동매칭으로 지급되면 true(웹훅), 관리자 수동지급이면 false(기본).
 */
export async function completeCharge(
  orderId: number,
  paidPrice?: number,
  auto: boolean = false,
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.chargeOrder.findUnique({ where: { id: orderId } });
    if (!order || order.charged || order.status === "CANCELED") return false;

    await tx.chargeOrder.update({
      where: { id: orderId },
      data: {
        status: "COMPLETED",
        charged: true,
        autoConfirmed: auto,
        paidPrice: paidPrice ?? order.amount,
        paidAt: new Date(),
      },
    });
    await adjustPoint(
      {
        userId: order.userId,
        amount: order.chargePoint,
        reason: "포인트 충전",
        relType: "charge",
        relId: order.id,
      },
      tx,
    );

    // 입금로그 연결: 금액 + 입금자명이 모두 일치하는 미매칭 로그만 붙인다.
    // 금액만 보고 붙이면 같은 금액을 넣은 다른 회원의 입금로그를 삼켜, 그 입금이
    // "처리됨"으로 묻힌다. 이름이 달라 못 붙는 건은 관리자가 matchDeposit 으로 직접 연결한다.
    const since = new Date(Date.now() - DEPOSIT_MATCH_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const hit = order.depositName
      ? await tx.depositLog
          .findMany({
            where: { matched: false, amount: order.amount, createdAt: { gte: since } },
            orderBy: { createdAt: "desc" },
          })
          .then((logs) =>
            logs.find(
              (l) => normDepositName(l.depositorName) === normDepositName(order.depositName),
            ),
          )
      : null;

    if (hit) {
      await tx.depositLog.update({
        where: { id: hit.id },
        data: { matched: true, matchedOrderId: order.id },
      });
      console.info(
        `[charge] linked deposit_log #${hit.id} -> charge_order #${order.id} (${hit.depositorName || "?"}, ${hit.amount}원)`,
      );
    }

    return true;
  });
}

/**
 * 자동매칭 기간이 지나도록 입금되지 않은 대기 주문을 취소한다.
 * 방치된 주문이 쌓이면 관리자가 실수로 수동지급(= 입금 1건에 포인트 중복 지급)할 위험이 있고,
 * 같은 금액의 새 신청도 중복으로 막힌다.
 * 취소 기준일은 웹훅 매칭 기간과 같아야 한다 — 더 짧으면 뒤늦게 입금한 회원이 지급을 못 받는다.
 */
export async function expireStaleChargeOrders(): Promise<number> {
  const cutoff = new Date(Date.now() - DEPOSIT_MATCH_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  try {
    const res = await prisma.chargeOrder.updateMany({
      where: { status: "PENDING", charged: false, createdAt: { lt: cutoff } },
      data: { status: "CANCELED" },
    });
    if (res.count > 0) {
      console.info(`[charge] 미입금 ${DEPOSIT_MATCH_WINDOW_DAYS}일 경과 주문 ${res.count}건 자동취소`);
    }
    return res.count;
  } catch (e) {
    console.error("[charge] 미입금 주문 자동취소 실패:", e);
    return 0;
  }
}
