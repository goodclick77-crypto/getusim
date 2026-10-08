import "server-only";
import { MockPaymentProvider } from "./mock";
import { TossPaymentProvider } from "./toss";
import { PayplePaymentProvider } from "./payple";
import {
  PaymentNotConfiguredError,
  type PaymentProvider,
  type PaymentProviderName,
  type PaymentWindowConfig,
} from "./types";

export * from "./types";

/**
 * 결제사 선택. PAYMENT_PROVIDER 환경변수로 갈아끼운다.
 *  - (없음)/none : 카드 결제 미도입 상태(현재 운영). 호출하면 NotConfigured.
 *  - mock        : 스테이징·로컬 미리보기용 가짜 결제사. 운영(NODE_ENV=production && 스테이징 아님)에서는 거부.
 *  - toss        : 토스페이먼츠 빌링. TOSS_SECRET_KEY 필요.
 *  - payple      : 페이플 앱카드(간편페이) 결제창. PAYPLE_* 환경변수 필요(payple.ts 참고). 빌링 없음.
 *  - kcp         : (예정) NHN KCP 재계약 시 어댑터 추가.
 *
 * 운영 여부 판단: RAILWAY_ENVIRONMENT_NAME 이 "production" 이면 운영으로 본다.
 */
const NAME = ((process.env.PAYMENT_PROVIDER || "none").trim().toLowerCase() as PaymentProviderName);

class NoneProvider implements PaymentProvider {
  readonly name = "none" as const;
  readonly supportsBilling = false;
  isConfigured() {
    return false;
  }
  async issueBillingKey(): Promise<never> {
    throw new PaymentNotConfiguredError("none");
  }
  async approve(): Promise<never> {
    throw new PaymentNotConfiguredError("none");
  }
  async confirm(): Promise<never> {
    throw new PaymentNotConfiguredError("none");
  }
  async cancel(): Promise<never> {
    throw new PaymentNotConfiguredError("none");
  }
}

let instance: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (instance) return instance;
  const isProd = (process.env.RAILWAY_ENVIRONMENT_NAME || "").toLowerCase() === "production";
  switch (NAME) {
    case "mock":
      if (isProd) {
        console.error("[pay] 운영 환경에서 mock 결제사는 사용할 수 없습니다 → none 으로 대체");
        instance = new NoneProvider();
      } else {
        instance = new MockPaymentProvider();
      }
      break;
    case "toss":
      instance = new TossPaymentProvider();
      break;
    case "payple":
      instance = new PayplePaymentProvider();
      break;
    case "kcp":
      console.error("[pay] kcp 어댑터는 아직 없습니다 → none 으로 대체");
      instance = new NoneProvider();
      break;
    default:
      instance = new NoneProvider();
  }
  return instance;
}

/** 화면에서 "카드 결제" 버튼을 보여줄지 판단 */
export function cardPaymentAvailable(): boolean {
  return getPaymentProvider().isConfigured();
}

/** 카드 등록·원클릭 결제(빌링키)를 보여줄지 판단 */
export function oneClickAvailable(): boolean {
  const p = getPaymentProvider();
  return p.isConfigured() && p.supportsBilling;
}

/**
 * 결제창을 띄우는 데 필요한 공개 설정(브라우저로 내려감). 비밀키는 절대 넣지 않는다.
 * 결제사별 결제창 컴포넌트가 이 값을 보고 SDK 를 호출한다.
 */
export function paymentWindowConfig(): PaymentWindowConfig {
  const p = getPaymentProvider();
  if (p instanceof PayplePaymentProvider) return { provider: "payple", ...p.windowConfig() };
  return { provider: "mock" };
}
