// 은행 입금 알림 문자 파서.
// 은행별로 형식이 달라 농협(NH)/국민(KB)을 각각 처리하고, parseDeposit 으로 통합한다.
//
// 국민(KB) 예) "엄*혜님 06/20 15:10 681702-**-***395 원준수 전자금융입금 10 잔액46,212"
//               └계좌주        └날짜  └시각  └계좌(마스킹)    └입금자명 └거래종류    └금액 └잔액
// 농협(NH) 예) "농협 입금1,100원\n06/27 12:45 302-****-3953-71 원준수 잔액1,110원"
//               └은행 └거래+금액      └날짜  └시각  └계좌(마스킹)     └입금자명 └잔액

export type ParsedDeposit = {
  amount: number; // 입금액(원)
  name: string; // 입금자명
  occurredAt: Date | null; // 입금 일시(연도는 현재연도로 가정)
};

// 문자에서 "MM/DD HH:MM" 형태의 일시 추출(연도 미표기 → 현재연도)
function parseWhen(text: string): Date | null {
  const d = text.match(/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{1,2})/);
  if (!d) return null;
  const now = new Date();
  return new Date(
    now.getFullYear(),
    Number(d[1]) - 1,
    Number(d[2]),
    Number(d[3]),
    Number(d[4]),
  );
}

/** 농협(NH) 입금 알림 파서. "입금1,100원 … 원준수 잔액1,110원" 형식. */
export function parseNhDeposit(text: string): ParsedDeposit | null {
  if (!text || !text.includes("입금")) return null;
  // 금액: '입금' 직후 금액(원). 예: "입금1,100원"
  const am = text.match(/입금\s*([\d,]+)\s*원/);
  if (!am) return null;
  const amount = Number(am[1].replace(/,/g, ""));
  if (!amount || isNaN(amount)) return null;
  // 입금자명: '잔액' 바로 앞의 한글/영문 이름 토큰
  const nm = text.match(/([가-힣A-Za-z][가-힣A-Za-z0-9]*)\s+잔액/);
  const name = nm ? nm[1].trim() : "";
  if (!name) return null;
  return { amount, name, occurredAt: parseWhen(text) };
}

/** 은행 무관 통합 파서 — 농협 먼저, 안 되면 국민 형식으로 시도. */
export function parseDeposit(text: string): ParsedDeposit | null {
  return parseNhDeposit(text) || parseKbDeposit(text);
}

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
