"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { notifyAdmin } from "@/lib/notify";
import { headers } from "next/headers";
import { rateLimit } from "@/lib/ratelimit";
import { verifyTurnstile } from "@/lib/turnstile";
import { isHoneypotHit } from "@/lib/honeypot";

const CONTENT_MAX = 3000;

const CAT_LABEL: Record<string, string> = {
  USAGE: "사용문의",
  REFUND: "환불문의",
  OTHER: "기타문의",
};

export async function createInquiry(formData: FormData) {
  const user = await requireUser();
  // 봇 함정 칸이 채워졌으면 저장하지 않고 성공한 것처럼 돌려보낸다(봇이 우회 시도하지 않도록)
  if (isHoneypotHit(formData)) {
    console.warn(`[inquiry] honeypot hit user=${user.id} (${user.loginId})`);
    redirect("/inquiry?ok=1");
  }
  const raw = String(formData.get("category") || "USAGE");
  const category = CAT_LABEL[raw] ? raw : "USAGE";
  const content = String(formData.get("content") || "").trim();
  if (!content) redirect("/inquiry?error=empty");
  if (content.length > CONTENT_MAX) redirect("/inquiry?error=long");

  // 도배 방지: 계정당 10분에 5건, 하루 20건
  const okShort = rateLimit(`inquiry:${user.id}`, 5, 10 * 60 * 1000);
  const okDay = rateLimit(`inquiry-day:${user.id}`, 20, 24 * 60 * 60 * 1000);
  if (!okShort || !okDay) redirect("/inquiry?error=rate");

  const ip = ((await headers()).get("x-forwarded-for") || "").split(",")[0].trim();
  if (!(await verifyTurnstile(formData, ip))) redirect("/inquiry?error=captcha");

  let refundPoint: number | null = null;
  let refundInfo: string | null = null;
  if (category === "REFUND") {
    refundInfo = String(formData.get("refundInfo") || "").trim().slice(0, 500);
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
