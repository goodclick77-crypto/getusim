"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { wonOf } from "@/lib/config";
import PaymentWindow from "./PaymentWindow";

type Method = "BALANCE" | "WINDOW" | "ONECLICK";

/**
 * 결제수단 선택 + 결제하기.
 *  - BALANCE : 잔액 차감(기존 포인트 경로). 잔액이 충분할 때만.
 *  - WINDOW  : PG 결제창(신용카드·간편결제). 카드 등록 없이 첫 결제부터 가능.
 *  - ONECLICK: 등록된 카드로 즉시 승인(빌링키).
 * 결제가 끝나면 번호가 발급되고 SMS 인증 화면으로 이동한다(진행 중 번호 자동 이어받기).
 */
export default function OrderForm({
  service,
  country,
  productName,
  pricePoint,
  amountWon,
  balancePoint,
  cardAvailable,
  savedCard,
}: {
  service: string;
  country: string;
  productName: string;
  pricePoint: number;
  amountWon: number;
  balancePoint: number;
  cardAvailable: boolean;
  savedCard: string | null;
}) {
  const router = useRouter();
  const balanceOk = balancePoint >= pricePoint;
  const options: { v: Method; label: string; sub: string; ok: boolean; icon: string }[] = [
    {
      v: "WINDOW",
      label: "신용카드 · 간편결제",
      sub: "카카오페이 · 네이버페이 · 토스페이 · 카드",
      ok: cardAvailable,
      icon: "fa-credit-card",
    },
    {
      v: "ONECLICK",
      label: "등록 카드로 바로 결제",
      sub: savedCard ?? "등록된 카드 없음",
      ok: cardAvailable && !!savedCard,
      icon: "fa-bolt",
    },
    {
      v: "BALANCE",
      label: "잔액에서 차감",
      sub: `보유 잔액 ${wonOf(balancePoint)}`,
      ok: balanceOk,
      icon: "fa-wallet",
    },
  ];
  const firstOk = options.find((o) => o.ok)?.v ?? "WINDOW";
  const [method, setMethod] = useState<Method>(firstOk);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [windowOpen, setWindowOpen] = useState(false);

  const canPay = agree && !busy && options.find((o) => o.v === method)?.ok;

  async function issue(body: Record<string, unknown>) {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/sms/number", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country, service, maxPoint: pricePoint, ...body }),
      });
      const j = await res.json();
      if (j.rentalId) {
        router.push("/sms?ordered=1");
        return;
      }
      setMsg(
        j.error === "00"
          ? "지금은 이 국가에 발급 가능한 번호가 없어 결제를 진행하지 않았습니다. 다른 국가를 선택해 주세요."
          : j.message || j.error || "주문에 실패했습니다. 다시 시도해 주세요.",
      );
    } catch {
      setMsg("일시적인 문제로 주문에 실패했습니다. 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  function pay() {
    if (!canPay) return;
    if (method === "WINDOW") {
      setWindowOpen(true); // 결제창 → 결제 완료 시 onPaid
      return;
    }
    void issue({ pay: method === "ONECLICK" ? "card" : "point" });
  }

  return (
    <>
      {/* 결제수단 */}
      <section className="glass rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-zinc-500">결제수단</h2>
        <div className="mt-3 space-y-2" role="radiogroup" aria-label="결제수단">
          {options.map((o) => {
            const on = method === o.v;
            return (
              <button
                key={o.v}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={!o.ok}
                onClick={() => setMethod(o.v)}
                className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
                  on ? "border-emerald-500 bg-emerald-50/60 shadow-sm" : "border-black/10 bg-white/50 hover:bg-white"
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${on ? "bg-emerald-600 text-white" : "bg-black/5 text-zinc-500"}`}
                >
                  <i className={`fa-solid ${o.icon}`} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{o.label}</span>
                  <span className="font-num block text-xs text-zinc-500">{o.sub}</span>
                </span>
                <i className={`fa-solid fa-circle-check ${on ? "text-emerald-600" : "text-zinc-200"}`} aria-hidden />
              </button>
            );
          })}
        </div>
        {!cardAvailable && !balanceOk && (
          <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
            잔액이 부족합니다.{" "}
            <Link href="/charge" className="underline">잔액 충전</Link> 후 주문해 주세요.
          </p>
        )}
      </section>

      {/* 결제 금액 + 동의 + 결제하기 */}
      <section className="glass rounded-2xl p-5">
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-zinc-500">상품 금액</dt>
            <dd className="font-num">{amountWon.toLocaleString("ko-KR")}원</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-zinc-500">할인</dt>
            <dd className="font-num">0원</dd>
          </div>
          <div className="flex justify-between border-t border-black/5 pt-2 text-base">
            <dt className="font-semibold">총 결제 금액</dt>
            <dd className="font-num font-bold text-emerald-700">{amountWon.toLocaleString("ko-KR")}원</dd>
          </div>
        </dl>

        <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            checked={agree}
            onChange={(e) => setAgree(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-emerald-600"
          />
          <span className="text-zinc-600">
            주문 내용과{" "}
            <Link href="/terms" target="_blank" className="text-emerald-700 underline">이용약관</Link>·
            <Link href="/refund" target="_blank" className="text-emerald-700 underline">환불규정</Link>
            을 확인했으며, 인증코드 수신이 완료된 건은 환불이 불가함에 동의합니다.
          </span>
        </label>

        <button
          type="button"
          onClick={pay}
          disabled={!canPay}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3.5 text-base font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50"
        >
          <i className={`fa-solid ${busy ? "fa-spinner fa-spin" : "fa-lock"}`} aria-hidden />
          {busy ? "처리 중…" : `${amountWon.toLocaleString("ko-KR")}원 결제하기`}
        </button>
        <p className="mt-2 text-center text-xs text-zinc-400">
          결제 후 번호가 발급되며, 코드를 받지 못하면 결제가 자동 취소됩니다.
        </p>

        {msg && (
          <p role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {msg}
          </p>
        )}
      </section>

      {windowOpen && (
        <PaymentWindow
          productName={productName}
          amountWon={amountWon}
          onClose={() => setWindowOpen(false)}
          onPaid={(token) => {
            setWindowOpen(false);
            void issue({ pay: "window", windowToken: token });
          }}
        />
      )}
    </>
  );
}
