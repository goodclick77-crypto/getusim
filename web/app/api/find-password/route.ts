import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signResetToken } from "@/lib/session";
import { sendMail } from "@/lib/notify";
import { rateLimit, clientIp } from "@/lib/ratelimit";

function redirectTo(path: string) {
  return new NextResponse(null, { status: 303, headers: { Location: path } });
}

// 본인확인: 아이디 + 이메일 일치 시, 등록된 이메일로 재설정 링크 발송.
// (정보만 맞으면 즉시 링크 노출하던 방식 → 이메일 소유 증명 방식으로 변경)
export async function POST(req: Request) {
  if (!rateLimit(`findpw:${clientIp(req)}`, 5, 10 * 60 * 1000)) {
    return redirectTo("/find-password?error=rate");
  }

  const form = await req.formData();
  const loginId = String(form.get("loginId") || "").trim();
  const email = String(form.get("email") || "").trim();
  if (!loginId || !email) return redirectTo("/find-password?error=empty");

  const user = await prisma.user.findFirst({
    where: {
      loginId,
      leftAt: null,
      email: { equals: email, mode: "insensitive" },
    },
  });

  // 계정 존재 여부를 노출하지 않기 위해, 일치 여부와 무관하게 동일한 응답을 반환한다.
  if (user && user.email) {
    try {
      const token = await signResetToken(user.id);
      // Railway 프록시 뒤에서도 공개 도메인으로 링크 생성
      const proto = req.headers.get("x-forwarded-proto") || "https";
      const host =
        req.headers.get("x-forwarded-host") ||
        req.headers.get("host") ||
        new URL(req.url).host;
      const link = `${proto}://${host}/find-password/reset?t=${encodeURIComponent(token)}`;
      await sendMail(
        user.email,
        "비밀번호 재설정 안내",
        `${user.name || user.loginId}님,\n\n` +
          `아래 링크에서 비밀번호를 재설정하세요. (요청 후 15분간 유효)\n${link}\n\n` +
          `본인이 요청하지 않았다면 이 메일을 무시하셔도 됩니다.`,
      );
    } catch (e) {
      // 메일 실패해도 동일 응답(정보 노출 방지). 원인은 서버 로그로 확인.
      console.error("[find-password] mail send failed:", e);
    }
  }

  return redirectTo("/find-password?sent=1");
}
