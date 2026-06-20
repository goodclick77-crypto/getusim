import "server-only";
import dns from "node:dns";
import nodemailer from "nodemailer";
import { prisma } from "./prisma";

// 일부 호스팅(Railway)은 IPv6 외부연결이 막혀 Gmail SMTP가 ENETUNREACH 남.
// IPv4 우선으로 강제해 회피.
dns.setDefaultResultOrder("ipv4first");

// 관리자 이메일 알림.
// 1순위: Resend (HTTP API, 호스팅 SMTP 포트차단 영향 없음) — RESEND_API_KEY, RESEND_FROM(선택)
// 2순위: Gmail SMTP — GMAIL_USER, GMAIL_APP_PASSWORD
// 공통: ADMIN_EMAIL(받는 주소)
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

function recipient() {
  return process.env.ADMIN_EMAIL || process.env.GMAIL_USER || "";
}

/** 사용 가능한 발송 수단이 있는지 */
export function mailerConfigured() {
  return !!process.env.RESEND_API_KEY || (!!process.env.GMAIL_USER && !!process.env.GMAIL_APP_PASSWORD);
}

export function mailerProvider(): "resend" | "gmail" | null {
  if (process.env.RESEND_API_KEY) return "resend";
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) return "gmail";
  return null;
}

let transporter: nodemailer.Transporter | null = null;
function gmailTransport() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user, pass },
    });
  }
  return transporter;
}

/** 실제 발송. 실패 시 throw. */
async function deliver(subject: string, text: string) {
  const to = recipient();
  if (!to) throw new Error("받는 주소(ADMIN_EMAIL)가 설정되지 않았습니다.");
  const fullSubject = `[GetUsim] ${subject}`;

  // 1순위: Resend (HTTPS)
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    const from = process.env.RESEND_FROM || "GetUsim <onboarding@resend.dev>";
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject: fullSubject, text }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Resend ${res.status}: ${detail.slice(0, 300)}`);
    }
    return;
  }

  // 2순위: Gmail SMTP
  const t = gmailTransport();
  if (!t) throw new Error("이메일 발송 수단이 설정되지 않았습니다. (RESEND_API_KEY 또는 GMAIL_USER/GMAIL_APP_PASSWORD)");
  await t.sendMail({
    from: `GetUsim <${process.env.GMAIL_USER}>`,
    to,
    subject: fullSubject,
    text,
  });
}

/** 설정이 켜진 이벤트일 때만 관리자에게 이메일 발송. 실패는 무시(주 흐름 방해 금지). */
export async function notifyAdmin(event: NotifyEvent, subject: string, body: string) {
  try {
    if (!mailerConfigured()) return;
    const cfg = await prisma.notifyConfig.findFirst();
    const on = cfg ? cfg[FIELD[event]] : DEFAULT_ON[event];
    if (!on) return;
    await deliver(subject, body);
  } catch (e) {
    console.error("[notify]", e);
  }
}

/** 설정 화면의 '테스트 발송'용. 성공/실패 여부를 반환. */
export async function sendTestEmail(): Promise<{ ok: boolean; error?: string }> {
  if (!mailerConfigured()) {
    return { ok: false, error: "발송 수단 미설정 (RESEND_API_KEY 또는 GMAIL_USER/GMAIL_APP_PASSWORD)" };
  }
  try {
    await deliver("알림 테스트", "이 메일이 보이면 관리자 이메일 알림이 정상 작동합니다.");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
