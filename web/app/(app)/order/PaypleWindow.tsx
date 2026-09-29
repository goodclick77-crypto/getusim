"use client";

import { useEffect, useRef } from "react";

/**
 * 페이플 앱카드(간편페이) 결제창 호출.
 * 마운트되면 SDK 를 불러와 결제창을 띄우고, 카드 인증이 끝나면 인증 결과(PCD_AUTH_KEY·
 * PCD_PAY_REQKEY)를 토큰으로 onPaid 에 넘긴다. 실제 승인(돈이 나가는 시점)은 서버 confirm 에서 한다.
 * 결제창 UI 는 페이플이 그리므로 이 컴포넌트는 화면에 아무것도 그리지 않는다.
 */

type PaypleResult = Record<string, string | undefined>;
declare global {
  interface Window {
    PaypleCpayAuthCheck?: (obj: Record<string, unknown>) => void;
    jQuery?: unknown;
  }
}

// payment.js 가 jQuery 를 전제로 한다(공식 샘플도 jQuery 를 먼저 로드).
const JQUERY = "https://code.jquery.com/jquery-3.7.1.min.js";

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[data-src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.dataset.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`스크립트 로드 실패: ${src}`));
    document.head.appendChild(s);
  });
}

export default function PaypleWindow({
  clientKey,
  scriptUrl,
  productName,
  amountWon,
  orderId,
  onClose,
  onPaid,
  onError,
}: {
  clientKey: string;
  scriptUrl: string;
  productName: string;
  amountWon: number;
  orderId: string;
  onClose: () => void;
  onPaid: (token: string) => void;
  onError: (msg: string) => void;
}) {
  const opened = useRef(false);

  useEffect(() => {
    if (opened.current) return; // StrictMode 이중 실행 방지 — 결제창은 한 번만
    opened.current = true;
    (async () => {
      try {
        if (!window.jQuery) await loadScript(JQUERY);
        await loadScript(scriptUrl);
        if (!window.PaypleCpayAuthCheck) throw new Error("결제 모듈을 불러오지 못했습니다");
        window.PaypleCpayAuthCheck({
          clientKey,
          PCD_PAY_TYPE: "card",
          PCD_PAY_WORK: "CERT", // 인증만 — 승인은 서버에서
          PCD_CARD_VER: "02", // 앱카드·간편페이 건별 결제
          PCD_PAY_GOODS: productName,
          PCD_PAY_TOTAL: amountWon,
          PCD_PAY_OID: orderId,
          // 상대경로여야 callbackFunction 이 동작한다(PC 레이어 / 모바일 새 창)
          PCD_RST_URL: "/api/payments/payple/result",
          callbackFunction: (res: PaypleResult) => {
            const rst = res.PCD_PAY_RST || res.PCD_PAY_RESULT;
            if (rst === "success" && res.PCD_AUTH_KEY && res.PCD_PAY_REQKEY) {
              onPaid(JSON.stringify({ authKey: res.PCD_AUTH_KEY, reqKey: res.PCD_PAY_REQKEY }));
            } else if (rst === "close") {
              onClose();
            } else {
              onError(res.PCD_PAY_MSG || "카드 인증에 실패했습니다. 다시 시도해 주세요.");
            }
          },
        });
      } catch (e) {
        console.error("[payple]", e);
        onError("결제창을 열지 못했습니다. 잠시 후 다시 시도해 주세요.");
      }
    })();
  }, [clientKey, scriptUrl, productName, amountWon, orderId, onClose, onPaid, onError]);

  return null;
}
