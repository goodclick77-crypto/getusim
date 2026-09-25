// Cloudflare Turnstile(보안문자) 서버 검증.
//   · TURNSTILE_SITE_KEY / TURNSTILE_SECRET_KEY 둘 다 설정돼야 켜진다.
//     (미설정이면 검증을 건너뜀 → 키 발급 전 배포해도 가입/문의가 막히지 않음)
//   · 토큰은 1회용. 폼 필드명은 위젯 기본값 "cf-turnstile-response".

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function turnstileSiteKey(): string | null {
  const site = process.env.TURNSTILE_SITE_KEY?.trim();
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  return site && secret ? site : null;
}

/** 보안문자 통과면 true. 비활성(키 미설정)이면 항상 true. */
export async function verifyTurnstile(form: FormData, ip?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret || !turnstileSiteKey()) return true;

  const token = String(form.get("cf-turnstile-response") || "");
  if (!token) return false;

  const body = new URLSearchParams({ secret, response: token });
  if (ip && ip !== "unknown") body.set("remoteip", ip);
  try {
    const res = await fetch(VERIFY_URL, { method: "POST", body });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (e) {
    // Cloudflare 장애 시 가입/문의 전면 차단보다는 통과시키고 로그만 남긴다
    // (속도제한은 별도로 계속 동작).
    console.error("[turnstile] verify failed:", e);
    return true;
  }
}
