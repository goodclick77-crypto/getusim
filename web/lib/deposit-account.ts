import "server-only";

/**
 * 무통장입금 안내 계좌.
 *
 * 사업자 계좌가 보이스피싱(입금 후 신고로 계좌를 묶는 수법 등)에 악용되지 않도록
 * 계좌번호는 페이지 HTML·클라이언트 번들에 텍스트로 싣지 않는다.
 *   - 화면 표시: /api/bank-account/image (로그인 사용자에게만 PNG로 그려서 내려줌)
 *   - 복사 버튼: /api/bank-account (누를 때만, 로그인 사용자에게만 텍스트 제공)
 * server-only 라서 클라이언트 컴포넌트에서 import 하면 빌드가 실패한다 — 의도된 안전장치.
 */
export const BANK_INFO = {
  bank: process.env.DEPOSIT_BANK || "농협은행",
  account: process.env.DEPOSIT_ACCOUNT || "301-0158-0663-91",
  holder: process.env.DEPOSIT_HOLDER || "엄전혜(위인터내셔널)",
};

/**
 * 계좌번호 이미지 크기(화면 표시 기준 CSS px). 레티나에서 선명하도록 이미지는
 * BANK_IMG_SCALE 배로 그리고 <img> 에는 이 크기로 표시한다. 계좌번호 길이에 따라
 * 폭이 달라지므로 서버에서 계산해 넘긴다(자리 잡힌 채로 로드 → 레이아웃 흔들림 없음).
 */
export const BANK_IMG_SCALE = 2;
export const BANK_IMG_FONT = 18; // 기존 텍스트 표시(sm:text-lg)와 같은 크기
export function bankImageSize(account = BANK_INFO.account) {
  // Montserrat Bold 실측: 숫자 ≈0.57em, 하이픈 ≈0.35em. 모자라면 글자가 잘리므로
  // 전부 숫자인 계좌번호도 들어가게 0.62em 으로 넉넉히 잡는다(남는 폭은 왼쪽 여백).
  return { width: Math.ceil(account.length * 0.62 * BANK_IMG_FONT) + 4, height: 28 };
}
