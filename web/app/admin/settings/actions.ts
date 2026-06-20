"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { sendTestEmail } from "@/lib/notify";

export async function saveNotifyConfig(formData: FormData) {
  await requireAdmin();
  const data = {
    onDeposit: formData.get("onDeposit") === "on",
    onChargeRequest: formData.get("onChargeRequest") === "on",
    onOrder: formData.get("onOrder") === "on",
    onInquiry: formData.get("onInquiry") === "on",
  };
  await prisma.notifyConfig.upsert({
    where: { id: 1 },
    create: { id: 1, ...data },
    update: data,
  });
  revalidatePath("/admin/settings");
  redirect("/admin/settings?ok=1");
}

export async function testEmail() {
  await requireAdmin();
  const res = await sendTestEmail();
  redirect(
    res.ok
      ? "/admin/settings?test=ok"
      : `/admin/settings?test=fail&msg=${encodeURIComponent(res.error || "")}`,
  );
}
