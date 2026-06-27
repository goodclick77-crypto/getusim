"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { notifyAdmin } from "@/lib/notify";

export async function createInquiry(formData: FormData) {
  const user = await requireUser();
  const category =
    String(formData.get("category") || "USAGE") === "REFUND" ? "REFUND" : "USAGE";
  const title = String(formData.get("title") || "").trim();
  const content = String(formData.get("content") || "").trim();
  if (!title || !content) redirect("/inquiry?error=empty");

  let refundPoint: number | null = null;
  let refundInfo: string | null = null;
  if (category === "REFUND") {
    refundPoint = Math.floor(Number(formData.get("refundPoint")));
    refundInfo = String(formData.get("refundInfo") || "").trim();
    if (!refundPoint || isNaN(refundPoint) || refundPoint <= 0 || !refundInfo) {
      redirect("/inquiry?error=refund");
    }
    if (refundPoint > user.point) {
      redirect("/inquiry?error=refund_over");
    }
  }

  await prisma.inquiry.create({
    data: {
      userId: user.id,
      category,
      title,
      content,
      status: "OPEN",
      refundPoint,
      refundInfo,
      name: user.name || user.loginId,
      email: user.email,
      phone: user.phone,
    },
  });

  const head = category === "REFUND" ? "환불 문의" : "1:1 문의";
  await notifyAdmin(
    "inquiry",
    `새 ${head}: ${title}`,
    `회원: ${user.name || user.loginId}\n분류: ${head}\n제목: ${title}` +
      (category === "REFUND"
        ? `\n환불 포인트: ${refundPoint?.toLocaleString("ko-KR")}P\n환불정보: ${refundInfo}`
        : "") +
      `\n\n${content}`,
  );

  revalidatePath("/inquiry");
  redirect("/inquiry?ok=1");
}
