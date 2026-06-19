"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { CHARGE_PACKAGES } from "@/lib/config";

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

  revalidatePath("/charge");
  redirect("/charge?ok=1");
}
