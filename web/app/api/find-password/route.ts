import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signResetToken } from "@/lib/session";

function redirectTo(path: string) {
  return new NextResponse(null, { status: 303, headers: { Location: path } });
}

// 본인확인: 아이디 + 이메일 + 휴대폰 일치 시 재설정 토큰 발급
export async function POST(req: Request) {
  const form = await req.formData();
  const loginId = String(form.get("loginId") || "").trim();
  const email = String(form.get("email") || "").trim();
  const phone = String(form.get("phone") || "").trim().replace(/[^\d]/g, "");

  if (!loginId || !email || !phone) return redirectTo("/find-password?error=empty");

  const user = await prisma.user.findFirst({
    where: {
      loginId,
      leftAt: null,
      email: { equals: email, mode: "insensitive" },
    },
  });

  const phoneMatch = user && user.phone.replace(/[^\d]/g, "") === phone;
  if (!user || !phoneMatch) return redirectTo("/find-password?error=nomatch");

  const token = await signResetToken(user.id);
  return redirectTo(`/find-password/reset?t=${encodeURIComponent(token)}`);
}
