"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function createFaq(formData: FormData) {
  await requireAdmin();
  const question = String(formData.get("question") || "").trim();
  const answer = String(formData.get("answer") || "").trim();
  const order = Number(formData.get("order") || 0);
  if (!question || !answer) redirect("/admin/faq?error=empty");

  await prisma.faq.create({ data: { question, answer, order: isNaN(order) ? 0 : order } });
  revalidatePath("/admin/faq");
  revalidatePath("/faq");
  redirect("/admin/faq?ok=1");
}

export async function updateFaq(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const question = String(formData.get("question") || "").trim();
  const answer = String(formData.get("answer") || "").trim();
  const order = Number(formData.get("order") || 0);
  if (!id || !question || !answer) redirect(`/admin/faq/${id}?error=empty`);

  await prisma.faq.update({
    where: { id },
    data: { question, answer, order: isNaN(order) ? 0 : order },
  });
  revalidatePath("/admin/faq");
  revalidatePath("/faq");
  redirect("/admin/faq?ok=1");
}

export async function deleteFaq(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  await prisma.faq.delete({ where: { id } }).catch(() => {});
  revalidatePath("/admin/faq");
  revalidatePath("/faq");
}
