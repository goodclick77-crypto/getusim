"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { wonOf } from "@/lib/config";

/**
 * 주문하기 — 포인트 충전 방식이라 결제수단은 "잔액 차감" 하나다.
 * 번호 발급은 무료이고, 인증코드를 받았을 때만 잔액에서 차감된다(미수신이면 차감 없음).
 * 잔액이 모자라면 잔액 충전(카드·간편결제 / 무통장)으로 보낸다.
 */
export default function OrderForm({
  service,
  country,
  pricePoint,
  amountWon,
  balancePoint,
}: {
  service: string;
  country: string;
  pricePoint: number;
  amountWon: number;
  balancePoint: number;
}) {
  const router = useRouter();
  const balanceOk = balancePoint >= pricePoint;
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const canOrder = agree && !busy && balanceOk;

  async function order() {
    if (!canOrder) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/sms/number", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country, service, maxPoint: pricePoint, pay: "point" }),
      });
      const j = await res.json();
      if (j.rentalId) {
        router.push("/sms?ordered=1");
        return;
      }
      setMsg(
        j.error === "00"
          ? "지금은 이 국가에 발급 가능한 번호가 없습니다. 잔액은 차감되지 않았습니다. 다른 국가를 선택해 주세요."
          : j.message || j.error || "주문에 실패했습니다. 다시 시도해 주세요.",
      );
    } catch {
      setMsg("일시적인 문제로 주문에 실패했습니다. 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* 결제수단: 잔액 */}
      <section className="glass rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-zinc-500">결제수단</h2>
        <div className="mt-3 flex items-center gap-3 rounded-xl border border-emerald-500 bg-emerald-50/60 px-4 py-3 shadow-sm">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
            <i className="fa-solid fa-wallet" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">잔액에서 차감</span>
            <span className="font-num block text-xs text-zinc-500">보유 잔액 {wonOf(balancePoint)}</span>
          </span>
          <Link
            href="/charge"
            className="shrink-0 rounded-lg border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50"
          >
            <i className="fa-solid fa-coins mr-1 text-emerald-600" aria-hidden /> 충전
          </Link>
        </div>
        {!balanceOk && (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
            <i className="fa-solid fa-triangle-exclamation mt-0.5" aria-hidden />
            <span>
              잔액이 부족합니다.{" "}
              <Link href="/charge" className="font-semibold underline">
                잔액 충전
              </Link>{" "}
              (카드·간편결제 즉시 충전) 후 주문해 주세요.
            </span>
          </p>
        )}
      </section>

      {/* 금액 + 동의 + 주문하기 */}
      <section className="glass rounded-2xl p-5">
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-zinc-500">상품 금액</dt>
            <dd className="font-num">{amountWon.toLocaleString("ko-KR")}원</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-zinc-500">보유 잔액</dt>
            <dd className="font-num">{wonOf(balancePoint)}</dd>
          </div>
          <div className="flex justify-between border-t border-black/5 pt-2 text-base">
            <dt className="font-semibold">수신 성공 시 차감</dt>
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
          onClick={order}
          disabled={!canOrder}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3.5 text-base font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50"
        >
          <i className={`fa-solid ${busy ? "fa-spinner fa-spin" : "fa-bolt"}`} aria-hidden />
          {busy ? "번호 발급 중…" : "주문하기 (번호 발급)"}
        </button>
        <p className="mt-2 text-center text-xs text-zinc-400">
          번호 발급은 무료이며, 인증코드를 받았을 때만 잔액에서 차감됩니다.
        </p>

        {msg && (
          <p role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {msg}
          </p>
        )}
      </section>
    </>
  );
}
