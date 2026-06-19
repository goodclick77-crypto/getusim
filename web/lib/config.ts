// 서비스 운영 상수 (추후 DB 설정/관리자 화면으로 이전 가능)

/** 무통장입금 안내 계좌 */
export const BANK_INFO = {
  bank: process.env.DEPOSIT_BANK || "국민은행",
  account: process.env.DEPOSIT_ACCOUNT || "000000-00-000000",
  holder: process.env.DEPOSIT_HOLDER || "(주)겟유심",
};

/** 충전 패키지 (결제금액 → 지급 포인트). 보너스 포함. */
export const CHARGE_PACKAGES = [
  { price: 10_000, point: 10_000 },
  { price: 30_000, point: 31_000 },
  { price: 50_000, point: 53_000 },
  { price: 100_000, point: 110_000 },
  { price: 300_000, point: 340_000 },
];

/**
 * 5sim 구매가 → 차감 포인트 환산.
 * 5sim 잔액 단위(루블/USD 등 계정 설정) 1당 차감 포인트.
 * 운영 마진을 여기서 조정한다.
 */
export const POINT_PER_5SIM_UNIT = Number(process.env.POINT_PER_5SIM_UNIT || 30);

export function fivesimPriceToPoint(price: number): number {
  return Math.ceil(price * POINT_PER_5SIM_UNIT);
}
