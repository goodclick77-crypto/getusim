"use client";

import { useEffect, useState } from "react";
import { COMPANY } from "@/lib/company";

/**
 * 결제창(PG 결제창이 뜨는 자리).
 * 실제 PG 연동 시 이 컴포넌트 대신 PG SDK 의 결제창을 호출하고, 결제 성공 콜백이 돌려주는
 * 결제키(paymentKey 등)를 onPaid 로 넘긴다. 서버는 그 키로 승인(confirm)한 뒤 번호를 발급한다.
 * 지금은 결제사 mock 이라 "결제하기"를 누르면 모의 결제키를 만들어 같은 흐름을 탄다.
 * 특정 PG·카드사 브랜드를 흉내 내지 않는 중립 디자인이다.
 */
const METHODS = [
  { v: "card", label: "신용·체크카드", icon: "fa-credit-card" },
  { v: "kakaopay", label: "카카오페이", icon: "fa-comment" },
  { v: "naverpay", label: "네이버페이", icon: "fa-n" },
  { v: "tosspay", label: "토스페이", icon: "fa-t" },
  { v: "transfer", label: "계좌이체", icon: "fa-building-columns" },
] as const;

export default function PaymentWindow({
  productName,
  amountWon,
  onClose,
  onPaid,
}: {
  productName: string;
  amountWon: number;
  onClose: () => void;
  onPaid: (token: string) => void;
}) {
  const [method, setMethod] = useState<(typeof METHODS)[number]["v"]>("card");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  function confirm() {
    setBusy(true);
    // 실제 PG 에서는 여기서 카드사 인증(앱카드·간편결제 앱)으로 넘어간다.
    setTimeout(() => onPaid(`mock-${method}-${Date.now()}`), 900);
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pw-title"
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* 결제창 헤더 */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3.5">
          <p id="pw-title" className="flex items-center gap-2 font-bold text-zinc-800">
            <i className="fa-solid fa-shield-halved text-emerald-600" aria-hidden /> 안전결제
          </p>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="닫기"
            className="rounded-lg px-2 py-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-50"
          >
            <i className="fa-solid fa-xmark" aria-hidden />
          </button>
        </div>

        <div className="px-5 py-4">
          {/* 주문 요약 */}
          <dl className="rounded-xl bg-zinc-50 px-4 py-3 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-zinc-500">가맹점</dt>
              <dd className="font-medium">{COMPANY.brand} ({COMPANY.name})</dd>
            </div>
            <div className="mt-1 flex justify-between gap-3">
              <dt className="text-zinc-500">상품명</dt>
              <dd className="truncate font-medium">{productName}</dd>
            </div>
            <div className="mt-2 flex justify-between gap-3 border-t border-zinc-200 pt-2">
              <dt className="font-semibold">결제금액</dt>
              <dd className="font-num text-lg font-bold text-emerald-700">
                {amountWon.toLocaleString("ko-KR")}원
              </dd>
            </div>
          </dl>

          {/* 결제수단 탭 */}
          <p className="mt-4 text-xs font-semibold text-zinc-500">결제수단 선택</p>
          <div className="mt-2 grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="결제수단">
            {METHODS.map((m) => {
              const on = method === m.v;
              return (
                <button
                  key={m.v}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setMethod(m.v)}
                  className={`flex flex-col items-center gap-1 rounded-xl border px-1 py-2.5 text-[11px] font-medium transition ${
                    on ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                  }`}
                >
                  <i className={`fa-solid ${m.icon} text-base`} aria-hidden />
                  {m.label}
                </button>
              );
            })}
          </div>

          {/* 수단별 입력 영역 */}
          <div className="mt-4 rounded-xl border border-zinc-200 p-4 text-sm">
            {method === "card" ? (
              <div className="space-y-2.5">
                <label className="block text-xs text-zinc-500">
                  카드번호
                  <input
                    inputMode="numeric"
                    placeholder="0000 - 0000 - 0000 - 0000"
                    className="font-num mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2.5 outline-none focus:border-emerald-500"
                  />
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <label className="block text-xs text-zinc-500">
                    유효기간
                    <input placeholder="MM / YY" className="font-num mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2.5 outline-none focus:border-emerald-500" />
                  </label>
                  <label className="block text-xs text-zinc-500">
                    비밀번호 앞 2자리
                    <input type="password" placeholder="••" className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2.5 outline-none focus:border-emerald-500" />
                  </label>
                </div>
                <label className="flex items-center gap-2 text-xs text-zinc-600">
                  <input type="checkbox" className="h-3.5 w-3.5 accent-emerald-600" /> 다음에도 이 카드로 한 번에 결제
                </label>
              </div>
            ) : method === "transfer" ? (
              <p className="text-zinc-600">
                은행 앱에서 본인 인증 후 즉시 이체됩니다. 결제하기를 누르면 은행 선택 화면으로 이동합니다.
              </p>
            ) : (
              <p className="text-zinc-600">
                결제하기를 누르면 {METHODS.find((m) => m.v === method)?.label} 앱(또는 QR)으로 연결됩니다. 앱에서
                인증하면 결제가 완료됩니다.
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={confirm}
            disabled={busy}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3.5 text-base font-bold text-white transition hover:bg-emerald-500 disabled:opacity-60"
          >
            <i className={`fa-solid ${busy ? "fa-spinner fa-spin" : "fa-lock"}`} aria-hidden />
            {busy ? "승인 요청 중…" : `${amountWon.toLocaleString("ko-KR")}원 결제하기`}
          </button>
          <p className="mt-2 text-center text-[11px] text-zinc-400">
            결제 정보는 결제대행사(PG)에 안전하게 전달되며 {COMPANY.brand}에 저장되지 않습니다.
          </p>
        </div>
      </div>
    </div>
  );
}
