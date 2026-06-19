"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function createInquiry(formData: FormData) {
  const user = await requireUser();
  const title = String(formData.get("title") || "").trim();
  const content = String(formData.get("content") || "").trim();
  if (!title || !content) redirect("/inquiry?error=empty");

  await prisma.inquiry.create({
    data: {
      userId: user.id,
      title,
      content,
      status: "OPEN",
      name: user.name || user.loginId,
      email: user.email,
      phone: user.phone,
    },
  });

  revalidatePath("/inquiry");
  redirect("/inquiry?ok=1");
}
