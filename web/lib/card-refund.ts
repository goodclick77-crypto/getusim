import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { adjustPoint, InsufficientPointError } from "./points";
import { getPaymentProvider } from "./payments";
import { cardRefundOf, cardRefundPlan } from "./charge";
import { chargeAmount } from "./config";

/**
 * 카드 충전 환불(결제사 승인취소) 공용 처리 — 관리자 충전내역 환불 버튼과 회원 환불신청 승인이 같이 쓴다.
 */

export type CardRefundResult =
  | { ok: true; point: number; amount: number; full: boolean }
  | { ok: false; error: "invalid" | "insufficient" | "pg_fail" };

/** 현재 결제사로 결제한, 아직 환불할 게 남은 카드 충전완료 건 — 최근 충전부터(먼저 충전한 포인트부터 썼다고 본다) */
export async function refundableCardOrders(userId: number) {
  const orders = await prisma.chargeOrder.findMany({
    where: {
      userId,
      method: "CARD",
      status: "COMPLETED",
      charged: true,
      pg: getPaymentProvider().name,
      pgTno: { not: "" },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, amount: true, chargePoint: true, legacyData: true },
  });
  return orders.filter((o) => cardRefundOf(o.legacyData).point < o.chargePoint);
}

/**
 * 포인트 환불을 카드 취소분과 계좌 송금분으로 나눈 예상치(화면 안내용). 실제 처리는 approveRefund 가 같은 순서로 한다.
 * 카드 결제는 최근 충전부터 취소하고, 카드로 못 채운 나머지만 계좌로 보낸다.
 */
export async function refundSplit(userId: number, point: number) {
  let left = point;
  let cardPoint = 0;
  let cardWon = 0;
  for (const o of await refundableCardOrders(userId)) {
    if (left <= 0) break;
    const p = cardRefundPlan(o, left);
    left -= p.point;
    cardPoint += p.point;
    cardWon += p.amount;
  }
  return { cardPoint, cardWon, bankPoint: left, bankWon: chargeAmount(left) };
}

/**
 * 카드 충전 1건 환불: 포인트 회수 → 결제사 취소(전액/부분). 결제사 취소 실패 시 이번 환불분만 원복.
 * want 가 있으면 최대치(미환불 충전분과 보유 포인트 중 작은 쪽) 안에서 그만큼만.
 * 포인트를 먼저 회수한다 — 취소를 먼저 하고 회수가 실패하면 돈도 돌려주고 포인트도 남는다.
 */
export async function refundCardOrder(
  id: number,
  opts: {
    want?: number;
    /** 포인트로그 사유·연결 — 없으면 충전 주문에 연결 */
    log?: (p: { point: number; amount: number; full: boolean }) => { reason: string; relType: string; relId: number };
  } = {},
): Promise<CardRefundResult> {
  let plan: { point: number; amount: number; full: boolean };
  let order: { userId: number; pgTno: string };
  try {
    ({ plan, order } = await prisma.$transaction(async (tx) => {
      // 같은 주문 동시 환불 방지(행 잠금) 후 최신 상태로 다시 읽는다
      await tx.$queryRaw`SELECT id FROM charge_order WHERE id = ${id} FOR UPDATE`;
      const o = await tx.chargeOrder.findUnique({ where: { id } });
      // 현재 결제사로 결제한 건만 — 레거시(KCP 등) 카드 건은 이 결제사로 취소할 수 없다
      if (
        !o ||
        o.method !== "CARD" ||
        o.status !== "COMPLETED" ||
        !o.charged ||
        !o.pgTno ||
        o.pg !== getPaymentProvider().name
      ) {
        throw new Error("INVALID");
      }
      const u = await tx.user.findUnique({ where: { id: o.userId }, select: { point: true } });
      const p = cardRefundPlan(o, u?.point ?? 0, opts.want);
      if (p.point <= 0 || p.amount <= 0) throw new InsufficientPointError();

      const log = opts.log?.(p) ?? {
        reason: p.full ? "카드 충전 환불(결제 취소)" : "카드 충전 부분환불(결제 부분취소)",
        relType: "charge_refund",
        relId: o.id,
      };
      // 잔액이 그 사이 줄었으면 InsufficientPointError → 트랜잭션 롤백
      await adjustPoint({ userId: o.userId, amount: -p.point, ...log }, tx);
      const prev = cardRefundOf(o.legacyData);
      await tx.chargeOrder.update({
        where: { id },
        data: {
          ...(p.full ? { status: "CANCELED" as const, charged: false } : {}),
          legacyData: {
            ...((o.legacyData ?? {}) as Record<string, unknown>),
            refundedPoint: prev.point + p.point,
            refundedAmount: prev.amount + p.amount,
            ...(p.full ? { refundedAt: new Date().toISOString() } : {}),
          },
        },
      });
      return { plan: p, order: { userId: o.userId, pgTno: o.pgTno } };
    }));
  } catch (e) {
    if (e instanceof InsufficientPointError) return { ok: false, error: "insufficient" };
    if (e instanceof Error && e.message === "INVALID") return { ok: false, error: "invalid" };
    throw e;
  }

  try {
    await getPaymentProvider().cancel({
      txId: order.pgTno,
      reason: "관리자 환불",
      amount: plan.amount, // 마지막 환불이면 결제액의 나머지 전부
    });
  } catch (e) {
    console.error(`[card-refund] 결제사 취소 실패 order#${id} tx=${order.pgTno} ${plan.amount}원:`, e);
    // 되돌리기: 이번 환불분만큼 기록을 빼고 포인트 재지급, 전액 환불이었으면 완료 상태로 복구
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM charge_order WHERE id = ${id} FOR UPDATE`;
      const o = await tx.chargeOrder.findUnique({ where: { id } });
      if (!o) return;
      const cur = cardRefundOf(o.legacyData);
      const data = { ...((o.legacyData ?? {}) as Record<string, unknown>) };
      data.refundedPoint = Math.max(0, cur.point - plan.point);
      data.refundedAmount = Math.max(0, cur.amount - plan.amount);
      delete data.refundedAt;
      await tx.chargeOrder.update({
        where: { id },
        data: {
          ...(plan.full ? { status: "COMPLETED" as const, charged: true } : {}),
          legacyData: data as Prisma.InputJsonObject,
        },
      });
      await adjustPoint(
        {
          userId: order.userId,
          amount: plan.point,
          reason: "카드 환불 실패로 포인트 복구",
          relType: "charge_refund",
          relId: id,
        },
        tx,
      );
    });
    return { ok: false, error: "pg_fail" };
  }

  return { ok: true, ...plan };
}
