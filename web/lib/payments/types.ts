/**
 * 결제사(PG) 추상 인터페이스.
 *
 * 겟유심의 결제 흐름은 "번호 발급(무료) → 발급 성공 시 카드 승인 → 코드 수신 시 확정 →
 * 미수신 시 승인취소" 이다. 어느 PG(KCP·토스페이먼츠·페이플 등)가 심사를 통과할지 아직 모르므로,
 * 호출부는 이 인터페이스만 보고 실제 결제사는 환경변수(PAYMENT_PROVIDER)로 갈아끼운다.
 *
 * 세 가지 능력만 요구한다. 이 세 개면 건별 원클릭 결제와 자동 취소가 전부 구현된다.
 *  1. issueBillingKey — 카드를 한 번 등록해 빌링키를 받는다(원클릭 결제의 전제).
 *  2. approve         — 빌링키로 금액을 승인한다(인증 1건 = 주문 1건).
 *  3. cancel          — 승인을 취소한다(코드 미수신·시간 초과·5sim 실패 시 자동 호출).
 */

export type PaymentProviderName = "none" | "mock" | "toss" | "kcp" | "payple";

export type BillingKeyResult = {
  /** PG가 발급한 빌링키. 카드번호 대신 이것만 저장한다. */
  billingKey: string;
  /** 표시용: 카드사·마스킹 번호 (예: "신한 **** 1234") */
  cardLabel: string;
};

export type ApproveParams = {
  billingKey: string;
  /** 우리 쪽 주문 식별자(멱등키 역할). 같은 orderId 로 두 번 승인되면 안 된다. */
  orderId: string;
  /** 원 단위 금액 */
  amount: number;
  /** 결제창·영수증에 보이는 상품명 (예: "SMS 인증 1건 · 텔레그램/영국") */
  orderName: string;
  customerId: string;
};

export type ApproveResult = {
  /** PG 거래번호. 취소·정산 대조에 쓴다. */
  txId: string;
  approvedAt: Date;
  /** PG가 돌려준 원본(감사·분쟁 대응용 보관) */
  raw?: unknown;
};

/** PG 결제창이 돌려준 결제키로 최종 승인(결제창 방식). 빌링키 없이 첫 결제부터 가능. */
export type ConfirmParams = {
  /** 결제창 성공 콜백의 결제키(토스 paymentKey 등) */
  token: string;
  orderId: string;
  amount: number;
  customerId: string;
};

export type CancelParams = {
  txId: string;
  /** 부분취소가 필요하면 금액 지정, 없으면 전액취소 */
  amount?: number;
  reason: string;
};

export type CancelResult = {
  canceledAt: Date;
  raw?: unknown;
};

export interface PaymentProvider {
  readonly name: PaymentProviderName;
  /** 운영 준비가 됐는지(키 설정 등). false 면 화면에서 카드 결제 옵션을 숨긴다. */
  isConfigured(): boolean;
  /** 빌링키(카드 등록·원클릭 결제)를 지원하는지. false 면 결제창 결제만 노출한다. */
  readonly supportsBilling: boolean;
  issueBillingKey(input: {
    customerId: string;
    /** PG 카드등록 창이 돌려준 인증 파라미터(authKey 등). PG마다 형태가 다르므로 그대로 넘긴다. */
    authPayload: Record<string, string>;
  }): Promise<BillingKeyResult>;
  approve(params: ApproveParams): Promise<ApproveResult>;
  /** 결제창 결제의 서버 최종 승인 */
  confirm(params: ConfirmParams): Promise<ApproveResult>;
  cancel(params: CancelParams): Promise<CancelResult>;
}

/** PG가 아직 설정되지 않았을 때 던지는 에러. 호출부는 이걸 잡아 "카드 결제 준비 중"으로 안내한다. */
export class PaymentNotConfiguredError extends Error {
  constructor(provider: string) {
    super(`결제사(${provider})가 설정되지 않았습니다`);
    this.name = "PaymentNotConfiguredError";
  }
}

/**
 * 결제사가 요청을 받고 "처리하지 않음"을 명확히 응답한 경우(실패 코드). 이 에러면 취소·승인이 일어나지 않은 게 확실하다.
 * 그 밖의 에러(네트워크 끊김·응답 이상)는 결제사 쪽에서 실제로 처리됐을 수도 있어 결과를 알 수 없다.
 */
export class PaymentDeclinedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentDeclinedError";
  }
}

/** 결제창을 띄우는 데 필요한 공개 설정(브라우저로 내려감). 비밀키는 절대 넣지 않는다. */
export type PaymentWindowConfig =
  | { provider: "mock" }
  | { provider: "payple"; clientKey: string; scriptUrl: string };
