"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { notifyAdmin } from "@/lib/notify";

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

  await notifyAdmin(
    "inquiry",
    `새 1:1 문의: ${title}`,
    `회원: ${user.name || user.loginId}\n제목: ${title}\n\n${content}`,
  );

  revalidatePath("/inquiry");
  redirect("/inquiry?ok=1");
}
