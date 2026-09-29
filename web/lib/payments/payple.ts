import "server-only";
import {
  PaymentNotConfiguredError,
  type ApproveResult,
  type BillingKeyResult,
  type CancelParams,
  type CancelResult,
  type ConfirmParams,
  type PaymentProvider,
} from "./types";

/**
 * 페이플 앱카드(간편페이) 결제창 어댑터. 건별 결제만 쓴다(빌링 없음).
 * 문서: https://docs.payple.kr/integration/domestic-card/app , /operation/domestic-card/cancel
 *
 * 흐름: 브라우저가 clientKey 로 결제창 호출(PCD_PAY_WORK=CERT) → 카드 인증 결과(PCD_AUTH_KEY,
 *       PCD_PAY_REQKEY)를 콜백으로 받음 → 서버가 confirm() 으로 최종 승인(이때 돈이 나감).
 *       취소는 파트너 인증(auth.php) → cPayCAct.php, PCD_REFUND_KEY 필요.
 *
 * 환경변수:
 *  PAYPLE_MODE        test | live (기본 test)
 *  PAYPLE_CST_ID      파트너 ID (cst_id)
 *  PAYPLE_CUST_KEY    파트너 인증키 (custKey)
 *  PAYPLE_CLIENT_KEY  결제창 호출용 공개키 (clientKey) — 브라우저로 내려간다
 *  PAYPLE_REFUND_KEY  취소용 키 (PCD_REFUND_KEY)
 *  PAYPLE_REFERER     페이플에 등록한 도메인의 사이트 주소 (예: https://xxx.up.railway.app).
 *                     없으면 RAILWAY_PUBLIC_DOMAIN 으로 만든다. 불일치 시 AUTH0004/AUTH0007.
 */
const LIVE = (process.env.PAYPLE_MODE || "test").toLowerCase() === "live";
const CPAY = LIVE ? "https://cpay.payple.kr" : "https://democpay.payple.kr";

/** 결제창 토큰: 브라우저 콜백이 넘긴 인증 결과 */
type WindowToken = { authKey: string; reqKey: string; cofUrl: string };

/**
 * 승인 요청 주소는 계정마다 달라 결제창 결과의 PCD_PAY_COFURL 을 써야 한다(고정 주소는 AUTH0008).
 * 다만 브라우저를 거친 값이라 변조될 수 있고, 요청에 custKey 가 실리므로 페이플 도메인(https)만 허용한다.
 */
function safeCofUrl(raw: string): string {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error(`[pay:payple] 승인 주소 형식 오류: ${raw}`);
  }
  if (u.protocol !== "https:" || !(u.hostname === "payple.kr" || u.hostname.endsWith(".payple.kr"))) {
    throw new Error(`[pay:payple] 허용되지 않은 승인 주소: ${raw}`);
  }
  return u.toString();
}

/**
 * 우리 쪽 txId 형식: "주문번호|결제일(YYYYMMDD)|금액".
 * 페이플 취소는 거래번호가 아니라 주문번호·결제일·금액으로 하므로 셋을 함께 보관한다.
 */
function packTx(oid: string, date: string, total: number) {
  return `${oid}|${date}|${total}`;
}
function unpackTx(txId: string) {
  const [oid, date, total] = txId.split("|");
  if (!oid || !/^\d{8}$/.test(date || "") || !(Number(total) > 0)) {
    throw new Error(`[pay:payple] 잘못된 txId: ${txId}`);
  }
  return { oid, date, total: Number(total) };
}

/** 한국 시각 기준 YYYYMMDD (결제시각이 응답에 없을 때의 대비) */
function kstDate(d = new Date()) {
  return new Date(d.getTime() + 9 * 3600_000).toISOString().slice(0, 10).replace(/-/g, "");
}

type PcdResponse = Record<string, string | undefined>;

export class PayplePaymentProvider implements PaymentProvider {
  readonly name = "payple" as const;
  readonly supportsBilling = false;
  private cstId = process.env.PAYPLE_CST_ID || "";
  private custKey = process.env.PAYPLE_CUST_KEY || "";
  private clientKey = process.env.PAYPLE_CLIENT_KEY || "";
  private refundKey = process.env.PAYPLE_REFUND_KEY || "";
  private referer =
    process.env.PAYPLE_REFERER ||
    (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : "");

  isConfigured() {
    return !!(this.cstId && this.custKey && this.clientKey && this.referer);
  }

  /** 브라우저로 내려가는 공개 값 */
  windowConfig() {
    return { clientKey: this.clientKey, scriptUrl: `${CPAY}/js/v1/payment.js` };
  }

  private async post(url: string, body: Record<string, string>): Promise<PcdResponse> {
    if (!this.isConfigured()) throw new PaymentNotConfiguredError("payple");
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        // Node fetch 는 Referer 를 붙이지 않는다. 페이플은 등록 도메인과 대조한다.
        Referer: this.referer,
      },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as PcdResponse;
    if (!res.ok) throw new Error(`[pay:payple] ${url} HTTP ${res.status} ${JSON.stringify(json)}`);
    return json;
  }

  async issueBillingKey(): Promise<BillingKeyResult> {
    throw new Error("[pay:payple] 빌링키 결제는 사용하지 않습니다(결제창 전용)");
  }

  async approve(): Promise<ApproveResult> {
    throw new Error("[pay:payple] 빌링키 결제는 사용하지 않습니다(결제창 전용)");
  }

  /** 결제창 인증 결과로 최종 승인. 주문번호·금액이 우리가 연 결제창과 다르면 즉시 취소한다. */
  async confirm(p: ConfirmParams): Promise<ApproveResult> {
    let tok: WindowToken;
    try {
      tok = JSON.parse(p.token) as WindowToken;
    } catch {
      throw new Error("[pay:payple] 결제창 토큰 형식 오류");
    }
    if (!tok?.authKey || !tok?.reqKey || !tok?.cofUrl) throw new Error("[pay:payple] 결제창 토큰 누락");

    const r = await this.post(safeCofUrl(tok.cofUrl), {
      PCD_CST_ID: this.cstId,
      PCD_CUST_KEY: this.custKey,
      PCD_AUTH_KEY: tok.authKey,
      PCD_PAYER_ID: "",
      PCD_PAY_REQKEY: tok.reqKey,
    });
    if (r.PCD_PAY_CODE !== "PCCF0000") {
      throw new Error(`[pay:payple] 승인 실패 ${r.PCD_PAY_CODE || ""} ${r.PCD_PAY_MSG || ""}`);
    }

    const date = /^\d{8}/.test(r.PCD_PAY_TIME || "") ? r.PCD_PAY_TIME!.slice(0, 8) : kstDate();
    const total = Number(r.PCD_PAY_TOTAL);
    const oid = r.PCD_PAY_OID || "";
    // 브라우저가 결제창에 넘긴 금액·주문번호는 회원이 조작할 수 있다. 승인 결과를 서버가 기대한 값과 대조.
    if (oid !== p.orderId || total !== p.amount) {
      console.error(
        `[pay:payple] ★ 승인값 불일치 — 기대 ${p.orderId}/${p.amount}원, 실제 ${oid}/${total}원 → 즉시 취소`,
      );
      await this.cancel({ txId: packTx(oid, date, total), reason: "결제 금액 불일치(자동 취소)" }).catch((e) =>
        console.error(`[pay:payple] ★★ 불일치 건 취소 실패 — 수동 취소 필요 oid=${oid} ${total}원`, e),
      );
      throw new Error("[pay:payple] 승인 금액/주문번호 불일치");
    }
    return { txId: packTx(oid, date, total), approvedAt: new Date(), raw: r };
  }

  async cancel(p: CancelParams): Promise<CancelResult> {
    if (!this.refundKey) throw new PaymentNotConfiguredError("payple(PAYPLE_REFUND_KEY)");
    const tx = unpackTx(p.txId);

    // 1) 취소용 파트너 인증 — 응답의 cst_id/custKey/AuthKey 는 매번 바뀌는 일회성 값
    const auth = await this.post(`${CPAY}/php/auth.php`, {
      cst_id: this.cstId,
      custKey: this.custKey,
      PCD_PAYCANCEL_FLAG: "Y",
    });
    if (auth.result !== "success" || !auth.AuthKey) {
      throw new Error(`[pay:payple] 취소 인증 실패 ${auth.result_msg || ""}`);
    }

    // 2) 승인취소
    const amount = p.amount ?? tx.total;
    const r = await this.post(`${CPAY}/php/account/api/cPayCAct.php`, {
      PCD_CST_ID: auth.cst_id || "",
      PCD_CUST_KEY: auth.custKey || "",
      PCD_AUTH_KEY: auth.AuthKey,
      PCD_REFUND_KEY: this.refundKey,
      PCD_PAYCANCEL_FLAG: "Y",
      PCD_PAY_OID: tx.oid,
      PCD_PAY_DATE: tx.date,
      PCD_REFUND_TOTAL: String(amount),
    });
    if (r.PCD_PAY_CODE !== "PAYC0000") {
      throw new Error(`[pay:payple] 취소 실패 ${r.PCD_PAY_CODE || ""} ${r.PCD_PAY_MSG || ""} (${p.reason})`);
    }
    return { canceledAt: new Date(), raw: r };
  }
}
