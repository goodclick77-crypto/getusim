import "server-only";
import {
  PaymentNotConfiguredError,
  type ApproveParams,
  type ApproveResult,
  type BillingKeyResult,
  type CancelParams,
  type CancelResult,
  type PaymentProvider,
} from "./types";

/**
 * 토스페이먼츠 빌링(자동결제) 어댑터.
 * 문서: https://docs.tosspayments.com/reference (빌링키 발급 → 빌링키로 결제 → 결제 취소)
 *
 * 필요한 환경변수: TOSS_SECRET_KEY (테스트키 test_sk_… / 라이브키 live_sk_…)
 * 인증 방식: Basic base64("<secretKey>:")
 *
 * ★ 심사 통과 전이라 실제 호출은 검증되지 않았다. 엔드포인트·필드명은 2026년 문서 기준이며,
 *   키를 받은 뒤 테스트키로 한 번 돌려 확인해야 한다.
 */
const BASE = "https://api.tosspayments.com/v1";

export class TossPaymentProvider implements PaymentProvider {
  readonly name = "toss" as const;
  private secret = process.env.TOSS_SECRET_KEY || "";

  isConfigured() {
    return this.secret.length > 0;
  }

  private headers() {
    if (!this.isConfigured()) throw new PaymentNotConfiguredError("toss");
    return {
      Authorization: `Basic ${Buffer.from(`${this.secret}:`).toString("base64")}`,
      "Content-Type": "application/json",
    };
  }

  private async call<T>(path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: {
        ...this.headers(),
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body: JSON.stringify(body ?? {}),
    });
    const json = (await res.json().catch(() => ({}))) as { code?: string; message?: string };
    if (!res.ok) {
      throw new Error(`[pay:toss] ${path} ${res.status} ${json.code || ""} ${json.message || ""}`);
    }
    return json as T;
  }

  /** 카드등록 창이 돌려준 authKey + customerKey 로 빌링키 발급 */
  async issueBillingKey(input: {
    customerId: string;
    authPayload: Record<string, string>;
  }): Promise<BillingKeyResult> {
    const r = await this.call<{ billingKey: string; card?: { company?: string; number?: string } }>(
      "/billing/authorizations/issue",
      { authKey: input.authPayload.authKey, customerKey: input.customerId },
    );
    const last4 = (r.card?.number || "").replace(/\D/g, "").slice(-4);
    return {
      billingKey: r.billingKey,
      cardLabel: `${r.card?.company || "카드"} **** ${last4 || "????"}`,
    };
  }

  async approve(p: ApproveParams): Promise<ApproveResult> {
    const r = await this.call<{ paymentKey: string; approvedAt: string }>(
      `/billing/${encodeURIComponent(p.billingKey)}`,
      {
        customerKey: p.customerId,
        amount: p.amount,
        orderId: p.orderId,
        orderName: p.orderName,
      },
      p.orderId, // 같은 주문 재시도 시 이중 승인 방지
    );
    return { txId: r.paymentKey, approvedAt: new Date(r.approvedAt), raw: r };
  }

  async cancel(p: CancelParams): Promise<CancelResult> {
    const r = await this.call<{ cancels?: { canceledAt: string }[] }>(
      `/payments/${encodeURIComponent(p.txId)}/cancel`,
      { cancelReason: p.reason, ...(p.amount ? { cancelAmount: p.amount } : {}) },
      `cancel-${p.txId}`,
    );
    const at = r.cancels?.at(-1)?.canceledAt;
    return { canceledAt: at ? new Date(at) : new Date(), raw: r };
  }
}
