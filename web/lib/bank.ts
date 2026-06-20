// 국민은행(KB) 입금 알림 문자 파서.
// 예) "엄*혜님 06/20 15:10 681702-**-***395 원준수 전자금융입금 10 잔액46,212"
//      └계좌주        └날짜  └시각  └계좌(마스킹)    └입금자명 └거래종류    └금액 └잔액

export type ParsedDeposit = {
  amount: number; // 입금액(원)
  name: string; // 입금자명
  occurredAt: Date | null; // 입금 일시(연도는 현재연도로 가정)
};

/** 입금 문자에서 입금자명/금액/일시를 추출. 입금이 아니거나 파싱 실패 시 null. */
export function parseKbDeposit(text: string): ParsedDeposit | null {
  if (!text) return null;
  // 출금/이체출금 등은 제외, '입금' 거래만 처리
  if (!text.includes("입금")) return null;

  // 입금자명 + 거래종류(…입금) + 금액 + '잔액'
  const m = text.match(/(\S+)\s+(\S*입금)\s+([\d,]+)\s*잔액/);
  if (!m) return null;

  const amount = Number(m[3].replace(/,/g, ""));
  if (!amount || isNaN(amount)) return null;

  const name = m[1].replace(/님$/, "").trim();

  // 날짜/시각 (예: 06/20 15:10) — 연도 미표기이므로 현재 연도 사용
  let occurredAt: Date | null = null;
  const d = text.match(/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{1,2})/);
  if (d) {
    const now = new Date();
    occurredAt = new Date(
      now.getFullYear(),
      Number(d[1]) - 1,
      Number(d[2]),
      Number(d[3]),
      Number(d[4]),
    );
  }

  return { amount, name, occurredAt };
}
