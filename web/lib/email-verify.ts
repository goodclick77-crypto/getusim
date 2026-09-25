import "server-only";
import { createHash, randomInt } from "crypto";
import { mailerConfigured } from "./notify";

// 회원가입 이메일 인증번호(6자리).
//   · 인메모리 보관(ratelimit.ts와 같은 Railway 단일 인스턴스 가정). 재배포 시 초기화 → 다시 받으면 됨.
//   · 발송 수단(RESEND/Gmail) 미설정이면 인증을 건너뜀 → 설정 전 배포해도 가입이 막히지 않음.

const TTL_MS = 10 * 60 * 1000; // 인증번호 유효 10분
const MAX_TRIES = 5; // 오입력 5회면 폐기

type Entry = { hash: string; exp: number; tries: number };
const codes = new Map<string, Entry>();

const norm = (email: string) => email.trim().toLowerCase();
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

export function emailVerifyEnabled(): boolean {
  return mailerConfigured();
}

// 받을 수 없는 예약 도메인 + 흔한 일회용 메일 도메인
const BLOCKED_DOMAINS = new Set([
  "example.com", "example.net", "example.org", "test.com", "localhost",
  "mailinator.com", "guerrillamail.com", "guerrillamail.net", "sharklasers.com", "grr.la",
  "10minutemail.com", "10minutemail.net", "tempmail.com", "temp-mail.org", "temp-mail.io",
  "tempmailo.com", "tempr.email", "yopmail.com", "yopmail.net", "trashmail.com",
  "getnada.com", "nada.email", "dispostable.com", "maildrop.cc", "mailnesia.com",
  "throwawaymail.com", "fakeinbox.com", "mohmal.com", "emailondeck.com", "mintemail.com",
  "spamgourmet.com", "mailcatch.com", "moakt.com", "tmail.ws", "tmpmail.org", "tmpmail.net",
  "mail.tm", "mail.gw", "inboxkitten.com", "burnermail.io", "33mail.com", "ncleap.com",
  "dropmail.me", "emlhub.com", "emltmp.com", "spymail.one",
]);
const BLOCKED_TLDS = [".test", ".invalid", ".example", ".localhost", ".local"];

/** 가입에 쓸 수 없는 이메일이면 사유 문자열, 괜찮으면 null. */
export function emailProblem(email: string): string | null {
  const e = norm(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return "이메일을 정확히 입력해주세요.";
  const domain = e.split("@")[1];
  if (BLOCKED_DOMAINS.has(domain) || BLOCKED_TLDS.some((t) => domain.endsWith(t))) {
    return "사용할 수 없는 이메일입니다. 평소 쓰는 이메일(네이버·Gmail 등)을 입력해주세요.";
  }
  return null;
}

/** 새 인증번호를 만들어 보관하고 반환(기존 번호는 무효). */
export function issueCode(email: string): string {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  codes.set(norm(email), { hash: sha(code), exp: Date.now() + TTL_MS, tries: 0 });
  // 만료된 항목 정리
  const now = Date.now();
  for (const [k, v] of codes) if (v.exp < now) codes.delete(k);
  return code;
}

/** 인증번호가 맞으면 true. 가입이 다른 사유(아이디 중복 등)로 실패해도 다시 쓰도록
 *  여기서는 폐기하지 않는다 → 가입 성공 후 clearCode 호출. */
export function checkCode(email: string, code: string): boolean {
  const key = norm(email);
  const entry = codes.get(key);
  if (!entry || entry.exp < Date.now()) {
    codes.delete(key);
    return false;
  }
  if (sha(code.trim()) !== entry.hash) {
    if (++entry.tries >= MAX_TRIES) codes.delete(key);
    return false;
  }
  return true;
}

export function clearCode(email: string) {
  codes.delete(norm(email));
}
