"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { chargeAmount, CHARGE_MIN_POINT, CHARGE_MAX_POINT } from "@/lib/config";
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
