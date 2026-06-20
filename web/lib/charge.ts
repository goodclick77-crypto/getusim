import { prisma } from "./prisma";
import { adjustPoint } from "./points";

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
    return true;
  });
}
