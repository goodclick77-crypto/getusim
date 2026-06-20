"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { CHARGE_PACKAGES } from "@/lib/config";
import { notifyAdmin } from "@/lib/notify";

export async function createChargeRequest(formData: FormData) {
  const user = await requireUser();
  const idx = Number(formData.get("package"));
  const depositName = String(formData.get("depositName") || "").trim();

  const pkg = CHARGE_PACKAGES[idx];
  if (!pkg) redirect("/charge?error=package");
  if (!depositName) redirect("/charge?error=deposit");

  await prisma.chargeOrder.create({
    data: {
      userId: user.id,
      amount: pkg.price,
      chargePoint: pkg.point,
      method: "BANK_TRANSFER",
      status: "PENDING",
      depositName,
    },
  });

  await notifyAdmin(
    "chargeRequest",
    `충전 신청 ${pkg.price.toLocaleString("ko-KR")}원`,
    `회원: ${user.name || user.loginId}\n입금자명: ${depositName}\n금액: ${pkg.price.toLocaleString("ko-KR")}원 (${pkg.point.toLocaleString("ko-KR")}P)\n입금 대기 중입니다.`,
  );

  revalidatePath("/charge");
  redirect("/charge?ok=1");
}
