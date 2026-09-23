import "server-only";
import type {
  ApproveParams,
  ApproveResult,
  BillingKeyResult,
  CancelParams,
  CancelResult,
  PaymentProvider,
} from "./types";

/**
 * 스테이징·로컬용 가짜 결제사. 실제 돈이 오가지 않고 무조건 성공한다.
 * PAYMENT_PROVIDER=mock 일 때만 선택되며, 운영에서는 절대 켜지 않는다(index.ts 에서 차단).
 * 결제 흐름(승인 → 확정 / 승인 → 취소)을 화면에서 미리 보는 용도.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock" as const;
  private seq = 0;

  isConfigured() {
    return true;
  }

  async issueBillingKey(input: { customerId: string }): Promise<BillingKeyResult> {
    return {
      billingKey: `mock-bk-${input.customerId}-${Date.now()}`,
      cardLabel: "테스트카드 **** 0000",
    };
  }

  async approve(p: ApproveParams): Promise<ApproveResult> {
    this.seq += 1;
    console.info(`[pay:mock] approve ${p.orderId} ${p.amount}원 (${p.orderName})`);
    return { txId: `mock-tx-${this.seq}-${p.orderId}`, approvedAt: new Date() };
  }

  async cancel(p: CancelParams): Promise<CancelResult> {
    console.info(`[pay:mock] cancel ${p.txId} (${p.reason})`);
    return { canceledAt: new Date() };
  }
}
