import "server-only";
import nodemailer from "nodemailer";
import { prisma } from "./prisma";

// 관리자 Gmail 이메일 알림.
// 환경변수: GMAIL_USER(보내는 Gmail), GMAIL_APP_PASSWORD(앱 비밀번호 16자), ADMIN_EMAIL(받는 주소, 미설정 시 GMAIL_USER)
export type NotifyEvent = "deposit" | "chargeRequest" | "order" | "inquiry";

const FIELD: Record<NotifyEvent, "onDeposit" | "onChargeRequest" | "onOrder" | "onInquiry"> = {
  deposit: "onDeposit",
  chargeRequest: "onChargeRequest",
  order: "onOrder",
  inquiry: "onInquiry",
};
const DEFAULT_ON: Record<NotifyEvent, boolean> = {
  deposit: true,
  chargeRequest: true,
  order: false,
  inquiry: true,
};

let transporter: nodemailer.Transporter | null = null;
function getTransport() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
    });
  }
  return transporter;
}

/** 설정이 켜진 이벤트일 때만 관리자에게 이메일 발송. 실패는 무시(주 흐름 방해 금지). */
export async function notifyAdmin(event: NotifyEvent, subject: string, body: string) {
  try {
    const t = getTransport();
    if (!t) return; // 환경변수 미설정 → 조용히 패스
    const cfg = await prisma.notifyConfig.findFirst();
    const on = cfg ? cfg[FIELD[event]] : DEFAULT_ON[event];
    if (!on) return;

    const to = process.env.ADMIN_EMAIL || process.env.GMAIL_USER;
    await t.sendMail({
      from: `GetUsim <${process.env.GMAIL_USER}>`,
      to,
      subject: `[GetUsim] ${subject}`,
      text: body,
    });
  } catch (e) {
    console.error("[notify]", e);
  }
}

/** 설정 화면의 '테스트 발송'용. 성공/실패 여부를 반환. */
export async function sendTestEmail(): Promise<{ ok: boolean; error?: string }> {
  const t = getTransport();
  if (!t) return { ok: false, error: "GMAIL_USER / GMAIL_APP_PASSWORD 환경변수가 설정되지 않았습니다." };
  try {
    const to = process.env.ADMIN_EMAIL || process.env.GMAIL_USER;
    await t.sendMail({
      from: `GetUsim <${process.env.GMAIL_USER}>`,
      to,
      subject: "[GetUsim] 알림 테스트",
      text: "이 메일이 보이면 관리자 이메일 알림이 정상 작동합니다.",
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
