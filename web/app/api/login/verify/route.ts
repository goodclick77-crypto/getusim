import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { adminChallengeAlive, finishAdminChallenge } from "@/lib/login-guard";
import { finishLogin } from "@/lib/login-finish";

function redirectTo(path: string) {
  return new NextResponse(null, { status: 303, headers: { Location: path } });
}

// 관리자 2단계: 이메일 인증번호 확인 후 로그인 완료
export async function POST(req: Request) {
  if (!rateLimit(`login-verify:${clientIp(req)}`, 10, 5 * 60 * 1000)) {
    return redirectTo("/login?error=rate");
  }
  const form = await req.formData();
  const c = String(form.get("c") || "");
  const code = String(form.get("code") || "");

  const userId = finishAdminChallenge(c, code);
  if (!userId) {
    return redirectTo(adminChallengeAlive(c) ? `/login/verify?c=${encodeURIComponent(c)}&error=invalid` : "/login?error=expired");
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.leftAt || user.role !== "ADMIN") return redirectTo("/login?error=expired");

  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim();
  const ua = (req.headers.get("user-agent") || "").slice(0, 200);
  return finishLogin(user, ip, ua);
}
