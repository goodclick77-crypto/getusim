"use client";

import { useState } from "react";

/**
 * 결제 카드 관리(내 정보). 등록하면 주문 페이지에서 "등록 카드로 바로 결제"(원클릭)를 쓸 수 있다.
 * 실제 PG 연동 시 registerCard 는 PG 카드등록 창을 띄워 authKey 를 받아 넘긴다. mock 은 즉시 발급.
 */
export default function CardManager({ initialLabel }: { initialLabel: string | null }) {
  const [label, setLabel] = useState<string | null>(initialLabel);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function register() {
    if (busy) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/payments/billing-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authPayload: {} }),
      });
      const j = await res.json();
      if (j.ok && j.card?.label) setLabel(j.card.label);
      else setMsg(j.error || "카드 등록에 실패했습니다");
    } catch {
      setMsg("카드 등록에 실패했습니다");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/payments/billing-key", { method: "DELETE" });
      setLabel(null);
    } catch {}
    setBusy(false);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-black/10 bg-white/60 px-4 py-3 text-sm">
        <span className="flex items-center gap-2">
          <i className="fa-regular fa-credit-card text-emerald-600" aria-hidden />
          {label ? (
            <b className="font-num">{label}</b>
          ) : (
            <span className="text-zinc-500">등록된 결제 카드가 없습니다</span>
          )}
        </span>
        {label ? (
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="rounded-lg border border-black/10 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-black/5 disabled:opacity-50"
          >
            카드 해제
          </button>
        ) : (
          <button
            type="button"
            onClick={register}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            <i className={`fa-solid ${busy ? "fa-spinner fa-spin" : "fa-plus"}`} aria-hidden />
            카드 등록
          </button>
        )}
      </div>
      <p className="text-xs text-zinc-500">
        카드를 등록하면 주문 페이지에서 결제창 없이 <b>한 번에 결제</b>할 수 있습니다. 카드번호는 저장되지
        않고 결제대행사가 발급한 키만 보관합니다.
      </p>
      {msg && <p className="text-xs text-red-600">{msg}</p>}
    </div>
  );
}
