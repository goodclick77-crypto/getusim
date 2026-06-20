"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function createNotice(formData: FormData) {
  const admin = await requireAdmin();
  const title = String(formData.get("title") || "").trim();
  const content = String(formData.get("content") || "").trim();
  const pinned = formData.get("pinned") === "on";
  if (!title || !content) redirect("/admin/notice?error=empty");

  await prisma.notice.create({
    data: { title, content, pinned, authorName: admin.name || "관리자" },
  });
  revalidatePath("/admin/notice");
  revalidatePath("/notice");
  redirect("/admin/notice?ok=1");
}

export async function deleteNotice(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  await prisma.notice.delete({ where: { id } }).catch(() => {});
  revalidatePath("/admin/notice");
  revalidatePath("/notice");
}

export async function togglePin(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const cur = await prisma.notice.findUnique({ where: { id }, select: { pinned: true } });
  if (cur) {
    await prisma.notice.update({ where: { id }, data: { pinned: !cur.pinned } });
  }
  revalidatePath("/admin/notice");
  revalidatePath("/notice");
}
