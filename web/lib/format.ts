export const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

/** 국제 전화번호 보기 좋게: +14685005762 → +1 468 500 5762 */
export function phoneFmt(raw: string | null | undefined): string {
  if (!raw) return "";
  const s = raw.replace(/[^\d+]/g, "");
  const plus = s.startsWith("+");
  const digits = plus ? s.slice(1) : s;
  // 끝에서 4-3-3 단위로 끊고 앞은 국가번호
  const parts: string[] = [];
  let rest = digits;
  const tail = [4, 3, 3];
  for (const n of tail) {
    if (rest.length <= n) {
      if (rest) parts.unshift(rest);
      rest = "";
      break;
    }
    parts.unshift(rest.slice(-n));
    rest = rest.slice(0, -n);
  }
  if (rest) parts.unshift(rest);
  return (plus ? "+" : "") + parts.join(" ");
}

/** 그누보드 HTML 본문을 줄바꿈 텍스트로 (이전된 공지/내용 정리) */
export function htmlToText(html: string | null | undefined): string {
  if (!html) return "";
  if (!/<[a-z!/]/i.test(html)) return html; // 태그 없으면 그대로
  return html
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/\s*(p|div|li|tr|h[1-6])\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
export const pt = (n: number) => `${n.toLocaleString("ko-KR")}P`;
export const ymd = (d: Date | string | null | undefined) => {
  if (!d) return "-";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (isNaN(dt.getTime())) return "-";
  return dt.toISOString().slice(0, 10);
};
export const ymdhm = (d: Date | string | null | undefined) => {
  if (!d) return "-";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (isNaN(dt.getTime())) return "-";
  return dt.toISOString().slice(0, 16).replace("T", " ");
};
