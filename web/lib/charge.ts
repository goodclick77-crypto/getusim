import { prisma } from "./prisma";
import { adjustPoint } from "./points";

// 입금로그 소급 매칭 검색 기간(일) — deposit-webhook 의 MATCH_WINDOW_DAYS 와 동일 의미.
const DEPOSIT_MATCH_WINDOW_DAYS = 14;

/**
 * 충전 주문을 완료 처리하고 포인트를 지급한다. (관리자 수동/입금 자동확인 공용)
 * 멱등: 이미 지급(charged)됐거나 취소된 주문이면 아무것도 하지 않고 false 반환.
 */
export async function completeCharge(
  orderId: number,
  paidPrice?: number,
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.chargeOrder.findUnique({ where: { id: orderId } });
    if (!order || order.charged || order.status === "CANCELED") return false;

    await tx.chargeOrder.update({
      where: { id: orderId },
      data: {
        status: "COMPLETED",
        charged: true,
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

    // 입금 자동감지 로그 연결(수동·자동 지급 공통):
    // 같은 금액·입금자명의 미매칭 입금로그가 있으면 이 주문으로 매칭 표시한다.
    // → 수동 지급한 입금이 "미매칭"으로 영원히 남던 문제 방지.
    if (order.depositName) {
      const since = new Date(Date.now() - DEPOSIT_MATCH_WINDOW_DAYS * 24 * 60 * 60 * 1000);
      const norm = (s: string) => s.replace(/\s/g, "");
      const logs = await tx.depositLog.findMany({
        where: { matched: false, amount: order.amount, createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
      });
      const hit = logs.find((l) => norm(l.depositorName) === norm(order.depositName));
      if (hit) {
        await tx.depositLog.update({
          where: { id: hit.id },
          data: { matched: true, matchedOrderId: order.id },
        });
      }
    }

    return true;
  });
}
