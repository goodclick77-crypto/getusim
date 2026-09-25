import { NextResponse } from "next/server";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { sendMail } from "@/lib/notify";
import { emailProblem, emailVerifyEnabled, issueCode } from "@/lib/email-verify";

// 회원가입 이메일 인증번호 발송. 응답: { ok: true } 또는 { ok: false, error }
export async function POST(req: Request) {
  const fail = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

  if (!emailVerifyEnabled()) return NextResponse.json({ ok: true, skipped: true });

  const ip = clientIp(req);
  // IP당 10분 5회 / 이메일당 1분 1회 / 전체 1시간 300회(봇이 IP를 바꿔가며 메일 한도를 소진하는 것 방지)
  if (!rateLimit(`send-code:ip:${ip}`, 5, 10 * 60 * 1000)) {
    return fail("요청이 너무 많습니다. 잠시 후 다시 시도해주세요.", 429);
  }
  if (!rateLimit("send-code:all", 300, 60 * 60 * 1000)) {
    console.warn(`[send-code] global cap hit ip=${ip}`);
    return fail("요청이 많아 잠시 발송이 제한되었습니다. 잠시 후 다시 시도해주세요.", 429);
  }

  let email = "";
  try {
    const body = (await req.json()) as { email?: unknown };
    email = String(body.email || "").trim();
  } catch {
    return fail("잘못된 요청입니다.");
  }
  const problem = emailProblem(email);
  if (problem) return fail(problem);

  if (!rateLimit(`send-code:email:${email.toLowerCase()}`, 1, 60 * 1000)) {
    return fail("인증번호는 1분에 한 번 받을 수 있습니다.", 429);
  }

  const code = issueCode(email);
  try {
    await sendMail(
      email,
      "회원가입 인증번호",
      `GetUsim 회원가입 인증번호는 ${code} 입니다.\n10분 안에 가입 화면에 입력해주세요.\n\n본인이 요청하지 않았다면 이 메일은 무시하셔도 됩니다.`,
    );
  } catch (e) {
    console.error("[send-code] mail send failed:", e);
    return fail("인증번호 발송에 실패했습니다. 이메일 주소를 확인하거나 잠시 후 다시 시도해주세요.", 502);
  }
  return NextResponse.json({ ok: true });
}
