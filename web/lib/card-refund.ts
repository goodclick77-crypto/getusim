import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { adjustPoint, InsufficientPointError } from "./points";
import { getPaymentProvider, PaymentDeclinedError } from "./payments";
import { notifyAdmin } from "./notify";
import { cardRefundOf, cardRefundPlan } from "./charge";
import { chargeAmount } from "./config";

/**
 * 카드 충전 환불(결제사 승인취소) 공용 처리 — 관리자 충전내역 환불 버튼과 회원 환불신청 승인이 같이 쓴다.
 */

/**
 * 환불 포인트로그 종류. 화면에서 "카드취소 환불"(결제 취소로 돌려줌)과 "포인트 환불"(계좌 입금)을 구분하는 기준.
 *  - REFUND_POINT: 환불신청 중 계좌로 보내는 몫(기존 포인트 환불과 같은 종류)
 *  - REFUND_CARD: 환불신청 중 카드 결제 취소로 돌려준 몫
 *  - CHARGE_REFUND: 관리자가 충전내역에서 직접 한 카드 환불
 */
export const REFUND_POINT = "refund";
export const REFUND_CARD = "refund_card";
export const CHARGE_REFUND = "charge_refund";
export const CARD_REFUND_TYPES = [REFUND_CARD, CHARGE_REFUND];

type Plan = { point: number; amount: number; full: boolean };

/**
 * ok: 환불 완료 / pg_fail: 결제사가 거절 → 포인트·기록 원복 /
 * pg_unknown: 결제사 응답 불명(실제 취소됐을 수 있음) → 원복하지 않고 "확인 필요"로 표시, 관리자가 결제사에서 확인 후 정리
 */
export type CardRefundResult =
  | ({ ok: true } & Plan)
  | ({ ok: false; error: "pg_fail" | "pg_unknown" } & Plan)
  | { ok: false; error: "invalid" | "insufficient" | "rental" };

/** 결제사 응답이 불명확해 관리자 확인을 기다리는 환불(legacyData.refundPending) */
export type PendingRefund = Plan & { at: string; error: string };

export function pendingRefundOf(legacyData: unknown): PendingRefund | null {
  const d = (legacyData ?? {}) as Record<string, unknown>;
  const p = d.refundPending as PendingRefund | undefined;
  return p && typeof p === "object" && Number(p.point) > 0 ? p : null;
}

/**
 * 문자 대기 중(PENDING)인 번호가 있는지. 번호 발급은 진행 중 번호 가격만큼 포인트를 예약해 두는데,
 * 그 사이 환불로 포인트를 빼면 코드가 도착해도 차감할 포인트가 없어 무료 수신(원가 손실)이 된다 → 환불을 막는다.
 * 만료시각이 지난 건도 스케줄러가 정산(늦게 온 코드 차감)하기 전까지는 포함한다(보통 몇 분 안에 정리됨).
 */
export async function hasPendingRental(userId: number): Promise<boolean> {
  return (await prisma.numberRental.count({ where: { userId, status: "PENDING" } })) > 0;
}

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
  // 확인 필요 상태인 건은 정리될 때까지 추가 환불하지 않는다
  return orders.filter(
    (o) => cardRefundOf(o.legacyData).point < o.chargePoint && !pendingRefundOf(o.legacyData),
  );
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
  let plan: Plan;
  let order: { userId: number; pgTno: string };
  const owner = await prisma.chargeOrder.findUnique({ where: { id }, select: { userId: true } });
  if (owner && (await hasPendingRental(owner.userId))) return { ok: false, error: "rental" };
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
        o.pg !== getPaymentProvider().name ||
        pendingRefundOf(o.legacyData)
      ) {
        throw new Error("INVALID");
      }
      const u = await tx.user.findUnique({ where: { id: o.userId }, select: { point: true } });
      const p = cardRefundPlan(o, u?.point ?? 0, opts.want);
      if (p.point <= 0 || p.amount <= 0) throw new InsufficientPointError();

      const log = opts.log?.(p) ?? {
        reason: `${p.full ? "카드취소 환불" : "카드취소 부분환불"} ${p.amount.toLocaleString("ko-KR")}원`,
        relType: CHARGE_REFUND,
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
    if (!(e instanceof PaymentDeclinedError)) {
      // 결제사에서 실제로 취소됐을 수도 있다 — 포인트를 되돌리면 "카드 환불 + 포인트 유지" 이중 환불이 된다.
      // 회수 상태를 유지하고 확인 필요로 표시, 관리자가 결제사 관리자에서 확인 후 정리(resolvePendingRefund).
      console.error(`[card-refund] ★ 결제사 취소 결과 불명 order#${id} tx=${order.pgTno} ${plan.amount}원:`, e);
      const pending: PendingRefund = { ...plan, at: new Date().toISOString(), error: String(e).slice(0, 300) };
      await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM charge_order WHERE id = ${id} FOR UPDATE`;
        const o = await tx.chargeOrder.findUnique({ where: { id } });
        if (!o) return;
        await tx.chargeOrder.update({
          where: { id },
          data: {
            legacyData: { ...((o.legacyData ?? {}) as Record<string, unknown>), refundPending: pending },
          },
        });
      });
      await notifyAdmin(
        "chargeRequest",
        "카드 환불 확인 필요",
        `충전 #${id} 카드 결제 ${plan.amount.toLocaleString("ko-KR")}원 취소 요청의 결과를 알 수 없습니다.\n` +
          `거래번호: ${order.pgTno}\n` +
          "결제사 관리자에서 취소 여부를 확인한 뒤 관리자 > 입금 확인에서 정리해 주세요.",
      ).catch(() => {});
      return { ok: false, error: "pg_unknown", ...plan };
    }
    console.error(`[card-refund] 결제사 취소 거절 order#${id} tx=${order.pgTno} ${plan.amount}원:`, e);
    await revertRefund(id, order.userId, plan);
    return { ok: false, error: "pg_fail", ...plan };
  }

  const who = await prisma.user
    .findUnique({ where: { id: order.userId }, select: { name: true, loginId: true } })
    .catch(() => null);
  await notifyAdmin(
    "deposit",
    `[카드취소] ${who?.name || who?.loginId || `회원 #${order.userId}`} ${plan.amount.toLocaleString("ko-KR")}원 환불`,
    `회원: ${who?.name || "-"} (${who?.loginId || order.userId})
취소 금액: ${plan.amount.toLocaleString("ko-KR")}원
회수 포인트: ${plan.point.toLocaleString("ko-KR")}P
${plan.full ? "전액 취소" : "부분 취소"} · 충전 #${id}
거래번호: ${order.pgTno}`,
  ).catch(() => {});

  return { ok: true, ...plan };
}

/** 이번 환불분 되돌리기: 누적 환불 기록에서 빼고 포인트 재지급, 전액 환불이었으면 완료 상태로 복구 */
async function revertRefund(id: number, userId: number, plan: Plan) {
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM charge_order WHERE id = ${id} FOR UPDATE`;
    const o = await tx.chargeOrder.findUnique({ where: { id } });
    if (!o) return;
    const cur = cardRefundOf(o.legacyData);
    const data = { ...((o.legacyData ?? {}) as Record<string, unknown>) };
    data.refundedPoint = Math.max(0, cur.point - plan.point);
    data.refundedAmount = Math.max(0, cur.amount - plan.amount);
    delete data.refundedAt;
    delete data.refundPending;
    await tx.chargeOrder.update({
      where: { id },
      data: {
        ...(plan.full ? { status: "COMPLETED" as const, charged: true } : {}),
        legacyData: data as Prisma.InputJsonObject,
      },
    });
    await adjustPoint(
      {
        userId,
        amount: plan.point,
        reason: "카드취소 실패로 포인트 복구",
        relType: CHARGE_REFUND,
        relId: id,
      },
      tx,
    );
  });
}

/**
 * 확인 필요 환불 정리(관리자가 결제사 관리자에서 확인한 뒤).
 * canceled=true: 결제사에서 취소됨 → 표시만 지운다. false: 취소 안 됨 → 회수한 포인트·기록 원복.
 */
export async function resolvePendingRefund(id: number, canceled: boolean): Promise<boolean> {
  const o = await prisma.chargeOrder.findUnique({ where: { id } });
  const pending = o && pendingRefundOf(o.legacyData);
  if (!o || !pending) return false;
  if (!canceled) {
    await revertRefund(id, o.userId, pending);
    return true;
  }
  const data = { ...((o.legacyData ?? {}) as Record<string, unknown>) };
  delete data.refundPending;
  await prisma.chargeOrder.update({ where: { id }, data: { legacyData: data as Prisma.InputJsonObject } });
  return true;
}

/**
 * 승인된 환불신청의 실제 처리 내역(포인트로그 기준): 카드취소 환불분 / 포인트 환불(계좌 입금)분.
 * 카드분 금액은 로그 사유에 적어 둔 원 단위 금액("카드취소 환불 3,300원 …")을 쓴다.
 */
export async function refundResults(inquiryIds: number[]) {
  const map = new Map<number, { cardPoint: number; cardWon: number; bankPoint: number; bankWon: number }>();
  if (!inquiryIds.length) return map;
  const logs = await prisma.pointLog.findMany({
    where: { relType: { in: [REFUND_POINT, REFUND_CARD] }, relId: { in: inquiryIds.map(String) }, amount: { lt: 0 } },
    select: { relType: true, relId: true, amount: true, reason: true },
  });
  for (const l of logs) {
    const id = Number(l.relId);
    const r = map.get(id) ?? { cardPoint: 0, cardWon: 0, bankPoint: 0, bankWon: 0 };
    const point = -l.amount;
    if (l.relType === REFUND_CARD) {
      r.cardPoint += point;
      r.cardWon += Number(/([\d,]+)원/.exec(l.reason)?.[1].replace(/,/g, "")) || chargeAmount(point);
    } else {
      r.bankPoint += point;
      r.bankWon += chargeAmount(point);
    }
    map.set(id, r);
  }
  return map;
}
