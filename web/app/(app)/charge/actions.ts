"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  chargeAmount,
  CHARGE_MIN_POINT,
  CHARGE_MAX_POINT,
  DEPOSIT_MATCH_WINDOW_DAYS,
  normDepositName,
} from "@/lib/config";
import { notifyAdmin } from "@/lib/notify";

export async function createChargeRequest(formData: FormData) {
  const user = await requireUser();
  const point = Number(formData.get("point"));
  const depositName = String(formData.get("depositName") || "").trim();

  if (
    !Number.isInteger(point) ||
    point < CHARGE_MIN_POINT ||
    point > CHARGE_MAX_POINT ||
    point % 1000 !== 0
  ) {
    redirect("/charge?error=amount");
  }
  if (!depositName) redirect("/charge?error=deposit");

  const amount = chargeAmount(point);

  // 중복 신청 차단.
  // 입금 자동매칭은 (금액 + 입금자명)으로 주문을 찾으므로, 그 둘이 같은 대기 주문이 여러 건이면
  // 입금 1건에 1건만 지급되고 나머지는 유령으로 남는다(→ 관리자 수동지급 시 중복 지급 위험).
  // 금액이나 입금자명이 다르면 매칭이 구분되므로 여러 건 공존을 허용한다.
  const since = new Date(Date.now() - DEPOSIT_MATCH_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const pendings = await prisma.chargeOrder.findMany({
    where: {
      userId: user.id,
      status: "PENDING",
      charged: false,
      amount,
      createdAt: { gte: since },
    },
    select: { depositName: true },
  });
  const dup = pendings.some(
    (o) => normDepositName(o.depositName) === normDepositName(depositName),
  );
  if (dup) redirect("/charge?error=dup");

  await prisma.chargeOrder.create({
    data: {
      userId: user.id,
      amount,
      chargePoint: point,
      method: "BANK_TRANSFER",
      status: "PENDING",
      depositName,
    },
  });

  await notifyAdmin(
    "chargeRequest",
    `충전 신청 ${amount.toLocaleString("ko-KR")}원`,
    `회원: ${user.name || user.loginId}\n입금자명: ${depositName}\n입금액: ${amount.toLocaleString("ko-KR")}원 (${point.toLocaleString("ko-KR")}P 충전)\n입금 대기 중입니다.`,
  );

  revalidatePath("/charge");
  redirect("/charge?ok=1");
}

/**
 * 본인의 입금대기 주문을 취소한다.
 * 중복신청이 차단되므로, 마음이 바뀐 회원이 같은 금액으로 다시 신청하려면 취소 수단이 필요하다.
 * 이미 지급된 주문은 건드리지 않는다.
 */
export async function cancelChargeRequest(formData: FormData) {
  const user = await requireUser();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) redirect("/charge");

  // 본인 소유 + 미지급 대기 건만 취소 (updateMany 조건으로 소유권까지 한 번에 검증)
  await prisma.chargeOrder.updateMany({
    where: { id, userId: user.id, status: "PENDING", charged: false },
    data: { status: "CANCELED" },
  });

  revalidatePath("/charge");
  redirect("/charge?canceled=1");
}
