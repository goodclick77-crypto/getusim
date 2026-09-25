// Honeypot(봇 함정) 필드. 사람에게는 보이지 않는 입력칸이라 정상 제출이면 항상 비어 있다.
// 폼을 통째로 채우는 자동화 봇이 값을 넣으면 봇으로 판정한다.
// 필드명은 브라우저 자동완성이 채우지 않을 이름으로 둔다.

export const HONEYPOT_FIELD = "hp_url";

/** 함정 칸이 채워졌으면 true(봇). */
export function isHoneypotHit(form: FormData): boolean {
  return String(form.get(HONEYPOT_FIELD) || "").trim() !== "";
}
