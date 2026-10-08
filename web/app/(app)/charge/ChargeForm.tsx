"use client";

import { useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import PaymentWindow from "@/components/PaymentWindow";
import PaypleWindow from "@/components/PaypleWindow";
import type { PaymentWindowConfig } from "@/lib/payments/types";

type Method = "CARD" | "BANK";

function SubmitButton({ amount, disabled }: { amount: number; disabled: boolean }) {
  const { pending } = useFormStatus();
  const isDisabled = disabled || pending;

  return (
    <button
      type="submit"
      disabled={isDisabled}
      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3.5 font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
    >
      <i className="fa-solid fa-paper-plane" aria-hidden />
      {pending
        ? "충전 신청 완료 처리 중..."
        : amount > 0
          ? `${amount.toLocaleString("ko-KR")}원 충전 신청`
          : "금액을 선택하세요"}
    </button>
  );
}

/**
 * 포인트 충전 폼. 결제사(PG)가 설정된 환경이면 "카드·간편결제"(결제창 → 즉시 충전)와
 * "무통장입금"(입금 확인 후 충전) 중에서 고른다. 결제사가 없으면 기존 무통장 폼 그대로.
 */
export default function ChargeForm({
  action,
  units,
  feeRate,
  defaultName,
  cardAvailable,
  bankAvailable = true,
  windowConfig,
  bankInfo,
}: {
  action: (formData: FormData) => void | Promise<void>;
  units: number[];
  feeRate: number;
  defaultName: string;
  cardAvailable: boolean;
  /** false 면 무통장입금 선택지를 숨기고 카드결제만 받는다(카드도 없으면 무통장 폼은 그대로 보인다) */
  bankAvailable?: boolean;
  /** 결제사별 결제창 공개 설정(payple 이면 페이플 결제창, 그 외 모의 결제창) */
  windowConfig: PaymentWindowConfig;
  /** 무통장 입금 계좌 안내(서버 렌더) — 무통장 선택 시에만 보인다 */
  bankInfo: ReactNode;
}) {
  const router = useRouter();
  const [point, setPoint] = useState(0);
  const [method, setMethod] = useState<Method>(cardAvailable ? "CARD" : "BANK");
  const showChoice = cardAvailable && bankAvailable;
  /** 결제창 주문번호. PG 는 결제창을 연 orderId·금액으로 승인을 대조하므로 열 때 만든다. 비어 있으면 결제창 닫힘 */
  const [windowOrderId, setWindowOrderId] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const amount = Math.round(point * feeRate);
  const productName = `포인트 충전 ${point.toLocaleString("ko-KR")}P`;

  function openWindow() {
    if (point <= 0 || busy) return;
    setMsg(null);
    setWindowOrderId(`C${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
  }

  async function onPaid(token: string) {
    const orderId = windowOrderId;
    setWindowOrderId("");
    setBusy(true);
    try {
      const res = await fetch("/api/payments/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ point, token, orderId }),
      });
      const j = await res.json().catch(() => ({}));
      if (j.ok) {
        setMsg({ ok: true, text: `${amount.toLocaleString("ko-KR")}원 결제가 완료되어 ${point.toLocaleString("ko-KR")}P 가 충전되었습니다.` });
        setPoint(0);
        router.refresh();
      } else {
        setMsg({ ok: false, text: j.error || "결제에 실패했습니다. 다시 시도해 주세요." });
      }
    } catch {
      setMsg({ ok: false, text: "일시적인 문제로 결제에 실패했습니다. 다시 시도해 주세요." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
    <form action={action} className="space-y-4">
      {showChoice && (
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="충전 방법">
          {(
            [
              { v: "CARD", label: "카드 · 간편결제", sub: "즉시 충전", icon: "fa-credit-card" },
              { v: "BANK", label: "무통장입금", sub: "입금 확인 후 충전", icon: "fa-building-columns" },
            ] as const
          ).map((o) => {
            const on = method === o.v;
            return (
              <button
                key={o.v}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setMethod(o.v)}
                className={`flex items-center gap-2.5 rounded-xl border px-3 py-3 text-left transition ${
                  on ? "border-emerald-500 bg-emerald-50/60 shadow-sm" : "border-black/10 bg-white/50 hover:bg-white"
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${on ? "bg-emerald-600 text-white" : "bg-black/5 text-zinc-500"}`}
                >
                  <i className={`fa-solid ${o.icon}`} aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{o.label}</span>
                  <span className="block text-xs text-zinc-500">{o.sub}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* 금액 단위 (누르면 누적) */}
      <div className="grid grid-cols-3 gap-2">
        {units.map((u) => (
          <button
            type="button"
            key={u}
            onClick={() => setPoint((p) => p + u)}
            className="font-num flex flex-col items-center rounded-xl border border-black/10 bg-white/60 py-2.5 text-sm font-semibold transition hover:border-emerald-400 hover:bg-emerald-50 active:scale-95"
          >
            +{u.toLocaleString("ko-KR")}P
            {/* 포인트 숫자만 보고 부가세를 빼고 입금하는 경우가 있어 실제 입금액을 같이 보여준다 */}
            <span className="mt-0.5 text-[11px] font-medium text-red-600">
              {Math.round(u * feeRate).toLocaleString("ko-KR")}원
            </span>
          </button>
        ))}
      </div>

      {/* 합계 */}
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-zinc-500">충전 포인트</span>
          <span className="font-num text-lg font-bold text-emerald-700">
            {point.toLocaleString("ko-KR")}P
          </span>
        </div>
        <div className="mt-1.5 flex items-center justify-between border-t border-emerald-200/70 pt-1.5">
          <span className="text-sm font-semibold text-red-600">
            {method === "CARD" ? "결제 금액" : "입금하실 금액"}
            <span className="ml-1.5 rounded bg-red-600 px-1.5 py-0.5 text-[11px] font-bold text-white">VAT 포함</span>
          </span>
          <span className="font-num text-2xl font-extrabold text-red-600">{amount.toLocaleString("ko-KR")}원</span>
        </div>
        {point > 0 && (
          <button
            type="button"
            onClick={() => setPoint(0)}
            className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-100"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            초기화
          </button>
        )}
      </div>

      <input type="hidden" name="point" value={point} />

      {method === "CARD" ? (
        <>
          <button
            type="button"
            onClick={openWindow}
            disabled={point <= 0 || busy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3.5 font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
          >
            <i className={`fa-solid ${busy ? "fa-spinner fa-spin" : "fa-lock"}`} aria-hidden />
            {busy
              ? "결제 확인 중…"
              : amount > 0
                ? `${amount.toLocaleString("ko-KR")}원 결제하고 충전`
                : "금액을 선택하세요"}
          </button>
          {msg && (
            <p
              role="alert"
              aria-live="polite"
              className={`rounded-xl px-4 py-3 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-600"}`}
            >
              {msg.text}
            </p>
          )}
        </>
      ) : (
        <>
          {bankInfo}
          {/* 입금자명 */}
          <div className="space-y-2">
            <label htmlFor="depositName" className="block text-sm font-semibold text-zinc-700">
              입금자명
            </label>
            <input
              id="depositName"
              name="depositName"
              maxLength={20}
              placeholder="입금하실 분의 이름"
              defaultValue={defaultName}
              aria-label="입금자명"
              className="w-full rounded-xl border border-black/10 bg-white/60 px-3.5 py-3 outline-none focus:border-emerald-500"
            />
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <i className="fa-solid fa-triangle-exclamation mt-0.5 shrink-0" aria-hidden />
              <p className="leading-relaxed">
                <b>입금자 이름</b>과 <b>입금 금액</b>이 신청 내용과{" "}
                <b className="text-amber-900 underline decoration-amber-400 underline-offset-2">
                  정확히 일치
                </b>
                해야 자동으로 충전됩니다. 위에 표시된 <b>입금하실 금액</b> 그대로 입금해 주세요.
              </p>
            </div>
          </div>

          <SubmitButton amount={amount} disabled={point <= 0} />
        </>
      )}
    </form>
    {/* 결제창은 폼 밖에 둔다 — 결제창 입력칸의 Enter 가 무통장 신청 폼을 제출하지 않게 */}
    {windowOrderId && windowConfig.provider === "payple" && (
      <PaypleWindow
        clientKey={windowConfig.clientKey}
        scriptUrl={windowConfig.scriptUrl}
        productName={productName}
        amountWon={amount}
        orderId={windowOrderId}
        onClose={() => setWindowOrderId("")}
        onError={(m) => {
          setWindowOrderId("");
          setMsg({ ok: false, text: m });
        }}
        onPaid={(token) => void onPaid(token)}
      />
    )}
    {windowOrderId && windowConfig.provider === "mock" && (
      <PaymentWindow
        productName={productName}
        amountWon={amount}
        orderId={windowOrderId}
        onClose={() => setWindowOrderId("")}
        onPaid={(token) => void onPaid(token)}
      />
    )}
    </>
  );
}
