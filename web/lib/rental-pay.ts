import "server-only";
import { prisma } from "./prisma";
import { getPaymentProvider } from "./payments";
import { chargeAmount, countryLabel, serviceLabel } from "./config";

/**
 * 건별 카드 결제와 발급건(NumberRental)을 잇는 얇은 계층.
 *
 * 흐름: 번호 발급(무료) 성공 → approveForRental(승인) → 코드 수신 시 captureRental(확정)
 *       / 미수신·밴·만료 시 voidRentalPayment(승인취소).
 * 승인은 발급이 성공한 뒤에만 하므로 "번호 없음"인 국가에서는 결제가 아예 일어나지 않는다.
 */

export function orderNameFor(country: string, service: string): string {
  return `${serviceLabel(service)} / ${countryLabel(country)} 인증 1건`;
}

/**
 * 발급건에 대해 빌링키 승인. 성공하면 APPROVED 로 기록하고 금액을 반환.
 * 실패하면 예외 — 호출부가 5sim 번호를 취소하고 발급건을 CANCELED 로 돌린다.
 */
export async function approveForRental(input: {
  rentalId: number;
  userId: number;
  billingKey: string;
  pricePoint: number;
  country: string;
  service: string;
}): Promise<{ amount: number; txId: string }> {
  const provider = getPaymentProvider();
  const amount = chargeAmount(input.pricePoint);
  const res = await provider.approve({
    billingKey: input.billingKey,
    orderId: `R${input.rentalId}`, // 발급건당 1회 — 같은 orderId 재승인은 PG 멱등키로 막힌다
    amount,
    orderName: orderNameFor(input.country, input.service),
    customerId: `U${input.userId}`,
  });
  try {
    await prisma.numberRental.update({
      where: { id: input.rentalId },
      data: { payMethod: "CARD", payAmount: amount, payTxId: res.txId, payStatus: "APPROVED" },
    });
  } catch (e) {
    // 돈은 나갔는데 기록을 못 했다 → 승인을 되돌린다. 그것마저 실패하면 txId 를 반드시 남긴다
    // (기록이 없으면 voidRentalPayment 도 이 거래를 모른다).
    console.error(`[pay] ★ 승인 기록 실패 rental#${input.rentalId} tx=${res.txId} — 취소 시도`, e);
    try {
      await provider.cancel({ txId: res.txId, reason: "발급건 기록 실패(자동 취소)" });
    } catch (e2) {
      console.error(`[pay] ★★ 승인취소도 실패 — 수동 취소 필요 tx=${res.txId} amount=${amount}`, e2);
    }
    throw e;
  }
  return { amount, txId: res.txId };
}

/** 코드 수신 → 승인 유지(매출 확정). 멱등. */
export async function captureRental(rentalId: number) {
  await prisma.numberRental.updateMany({
    where: { id: rentalId, payMethod: "CARD", payStatus: "APPROVED" },
    data: { payStatus: "CAPTURED" },
  });
}

/**
 * 코드 미수신 → 승인취소. 멱등: APPROVED 인 건만 처리한다.
 * PG 취소가 실패하면 CANCEL_FAILED 로 남겨 관리자가 수동 취소할 수 있게 한다(돈이 걸린 상태를
 * 조용히 잃어버리지 않기 위해). 호출부 흐름은 막지 않는다.
 */
export async function voidRentalPayment(rentalId: number, reason: string): Promise<void> {
  const r = await prisma.numberRental.findUnique({
    where: { id: rentalId },
    select: { payMethod: true, payStatus: true, payTxId: true },
  });
  if (!r || r.payMethod !== "CARD" || r.payStatus !== "APPROVED" || !r.payTxId) return;
  try {
    await getPaymentProvider().cancel({ txId: r.payTxId, reason });
    await prisma.numberRental.updateMany({
      where: { id: rentalId, payStatus: "APPROVED" },
      data: { payStatus: "CANCELED" },
    });
  } catch (e) {
    console.error(`[pay] 승인취소 실패 rental#${rentalId} tx=${r.payTxId}:`, e);
    await prisma.numberRental
      .updateMany({ where: { id: rentalId, payStatus: "APPROVED" }, data: { payStatus: "CANCEL_FAILED" } })
      .catch(() => {});
  }
}
