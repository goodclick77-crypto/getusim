import { prisma } from "./prisma";
import { fivesim, FiveSimError } from "./fivesim";

type RentalLike = {
  id: number;
  userId: number;
  pricePoint: number;
  fivesimId: string | null;
};

/**
 * PENDING 발급건에 코드 수신을 반영(멱등):
 *  - RECEIVED 전환 + 정액 차감(보유 범위 내 → 음수 방지) + 포인트로그
 *  - 5sim finish 호출(주문 완료 처리, best-effort)
 * 차감 후 잔액을 반환(이미 처리됐거나 미차감이면 null).
 */
export async function settleReceived(
  rental: RentalLike,
  code: string,
  text: string | null,
): Promise<number | null> {
  let balanceAfter: number | null = null;
  let credited = false;

  await prisma.$transaction(async (tx) => {
    const upd = await tx.numberRental.updateMany({
      where: { id: rental.id, status: "PENDING" },
      data: { status: "RECEIVED", smsCode: code, smsText: text ?? undefined },
    });
    if (upd.count !== 1) return; // 동시 처리/이미 반영 → 중복 차감 방지
    credited = true;

    // 정액 차감하되 보유 포인트를 넘지 않도록(음수 방지). 발급~수신 사이 차감/환불 대비.
    const cur = await tx.user.findUnique({
      where: { id: rental.userId },
      select: { point: true },
    });
    const deduct = Math.min(cur?.point ?? 0, rental.pricePoint);
    const updated = await tx.user.update({
      where: { id: rental.userId },
      data: { point: { decrement: deduct } },
      select: { point: true },
    });
    balanceAfter = updated.point;
    await tx.pointLog.create({
      data: {
        userId: rental.userId,
        amount: -deduct,
        balanceAfter: updated.point,
        reason: `SMS 인증코드 (NO:${rental.fivesimId})`,
        relType: "rental",
        relId: String(rental.id),
      },
    });
  });

  if (credited && rental.fivesimId) {
    try {
      await fivesim.finish(rental.fivesimId);
    } catch {
      /* finish 실패는 정산에 영향 없음 */
    }
  }
  return balanceAfter;
}

async function markExpired(id: number) {
  await prisma.numberRental
    .updateMany({ where: { id, status: "PENDING" }, data: { status: "EXPIRED" } })
    .catch(() => {});
}

/**
 * 만료시간이 지난 PENDING 발급건을 5sim과 대사해 정리:
 *  - 코드가 실제 도착했으면 → 차감/RECEIVED 로 매출 확보(이탈해도 정산)
 *  - 코드 없으면 → 5sim cancel(원가 환불) 후 EXPIRED
 * 외부호출 비용이 있어 1회 처리량을 제한하고 각 건은 독립적으로 실패 격리.
 */
export async function expireStaleRentals() {
  const now = new Date();
  let stale: RentalLike[] = [];
  try {
    stale = await prisma.numberRental.findMany({
      where: {
        status: "PENDING",
        OR: [
          { expiresAt: { lt: now } },
          {
            expiresAt: null,
            createdAt: { lt: new Date(now.getTime() - 30 * 60 * 1000) },
          },
        ],
      },
      select: { id: true, userId: true, pricePoint: true, fivesimId: true },
      take: 12,
    });
  } catch {
    return; // 조회 실패는 무시(주 흐름 방해 금지)
  }

  await Promise.allSettled(
    stale.map(async (r) => {
      try {
        if (!r.fivesimId) return markExpired(r.id);
        let order;
        try {
          order = await fivesim.check(r.fivesimId);
        } catch (e) {
          if (e instanceof FiveSimError) return markExpired(r.id);
          throw e;
        }
        const sms = order.sms?.[0];
        if (sms?.code) {
          await settleReceived(r, sms.code, sms.text); // 코드 도착 → 매출 확보
        } else {
          try {
            await fivesim.cancel(r.fivesimId); // 미수신 → 원가 환불
          } catch {
            /* cancel 실패해도 만료 처리는 진행 */
          }
          await markExpired(r.id);
        }
      } catch {
        await markExpired(r.id);
      }
    }),
  );
}
