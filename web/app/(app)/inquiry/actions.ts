"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { notifyAdmin } from "@/lib/notify";

const CAT_LABEL: Record<string, string> = {
  USAGE: "사용문의",
  REFUND: "환불문의",
  OTHER: "기타문의",
};

export async function createInquiry(formData: FormData) {
  const user = await requireUser();
  const raw = String(formData.get("category") || "USAGE");
  const category = CAT_LABEL[raw] ? raw : "USAGE";
  const content = String(formData.get("content") || "").trim();
  if (!content) redirect("/inquiry?error=empty");

  let refundPoint: number | null = null;
  let refundInfo: string | null = null;
  if (category === "REFUND") {
    refundInfo = String(formData.get("refundInfo") || "").trim();
    // 환불은 보유 포인트 "전액"만 — 금액은 서버에서 결정(클라이언트 값 신뢰 안 함)
    refundPoint = user.point;
    if (!refundInfo || refundPoint <= 0) {
      redirect("/inquiry?error=refund");
    }
  }

  // 제목은 입력받지 않고 내용 첫 줄로 자동 생성(목록 표시용)
  const title =
    content.split("\n")[0].trim().slice(0, 40) || CAT_LABEL[category];

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

  const head = CAT_LABEL[category];
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
