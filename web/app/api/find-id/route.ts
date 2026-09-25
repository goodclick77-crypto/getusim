import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/notify";
import { rateLimit, clientIp } from "@/lib/ratelimit";

function redirectTo(path: string) {
  return new NextResponse(null, { status: 303, headers: { Location: path } });
}

// 이메일로 가입된 아이디를 그 이메일로 발송. (계정 존재 노출 방지: 항상 동일 응답)
export async function POST(req: Request) {
  if (!rateLimit(`findid:${clientIp(req)}`, 5, 10 * 60 * 1000)) {
    return redirectTo("/find-id?error=rate");
  }

  const form = await req.formData();
  const email = String(form.get("email") || "").trim();
  if (!email) return redirectTo("/find-id?error=empty");

  const users = await prisma.user.findMany({
    where: { leftAt: null, email: { equals: email, mode: "insensitive" } },
    select: { loginId: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  // 같은 이메일로는 10분에 1통(IP를 바꿔가며 메일 폭탄 방지). 응답은 동일하게 유지.
  if (users.length > 0 && rateLimit(`findid:email:${email.toLowerCase()}`, 1, 10 * 60 * 1000)) {
    try {
      const list = users
        .map(
          (u) =>
            `· ${u.loginId}  (가입일 ${u.createdAt.toISOString().slice(0, 10)})`,
        )
        .join("\n");
      await sendMail(
        email,
        "아이디 찾기 안내",
        `요청하신 이메일로 가입된 아이디입니다.\n\n${list}\n\n` +
          `본인이 요청하지 않았다면 이 메일을 무시하셔도 됩니다.`,
      );
    } catch (e) {
      console.error("[find-id] mail send failed:", e);
    }
  }

  return redirectTo("/find-id?sent=1");
}
