"use client";

import { useState } from "react";
import { createInquiry } from "./actions";
import Turnstile from "@/components/Turnstile";
import Honeypot from "@/components/Honeypot";

const CATS = [
  { v: "USAGE", label: "사용문의", icon: "fa-circle-question" },
  { v: "REFUND", label: "환불문의", icon: "fa-rotate-left" },
  { v: "OTHER", label: "기타문의", icon: "fa-ellipsis" },
] as const;

export default function InquiryForm({
  currentPoint,
  refundWon,
  cardWon,
  bankWon,
  siteKey,
}: {
  currentPoint: number;
  refundWon: number;
  /** 카드 결제 취소로 돌려받을 금액(카드로 충전한 포인트분) */
  cardWon: number;
  /** 계좌로 받을 금액(그 외 포인트분) */
  bankWon: number;
  siteKey: string | null;
}) {
  const [category, setCategory] = useState<"USAGE" | "REFUND" | "OTHER">("USAGE");
  const refund = category === "REFUND";
  const canRefund = currentPoint > 0;

  return (
    <form action={createInquiry} className="space-y-3">
      <input type="hidden" name="category" value={category} />

      {/* 분류 선택 */}
      <div className="grid grid-cols-3 gap-2">
        {CATS.map((c) => (
          <button
            key={c.v}
            type="button"
            onClick={() => setCategory(c.v)}
            className={`flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 text-sm font-medium transition ${
              category === c.v
                ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                : "border-black/10 text-zinc-600 hover:bg-black/[0.02]"
            }`}
          >
            <i className={`fa-solid ${c.icon}`} aria-hidden /> {c.label}
          </button>
        ))}
      </div>

      <textarea
        name="content"
        required
        placeholder={refund ? "환불 사유를 적어주세요" : "문의 내용을 입력하세요"}
        rows={5}
        maxLength={3000}
        aria-label="문의 내용"
        className="w-full rounded-xl border border-black/10 bg-white/60 px-3.5 py-3 outline-none focus:border-emerald-500"
      />

      {/* 환불 신청 정보 (전액 환불만) */}
      {refund && (
        <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
          <p className="text-sm font-semibold text-emerald-700">환불 신청 정보</p>
          {canRefund ? (
            <>
              <div className="rounded-lg bg-white px-3.5 py-3">
                <p className="text-xs text-zinc-500">환불 신청 포인트 (전액)</p>
                <p className="font-num text-2xl font-bold text-zinc-900">
                  {currentPoint.toLocaleString("ko-KR")} P
                </p>
                <p className="font-num mt-1 text-sm font-semibold text-emerald-700">
                  환불 금액 {refundWon.toLocaleString("ko-KR")}원{" "}
                  <span className="text-xs font-normal text-zinc-500">(부가세 포함)</span>
                </p>
                {cardWon > 0 && (
                  <ul className="font-num mt-2 space-y-0.5 text-xs text-zinc-600">
                    <li className="text-violet-700">
                      · 카드취소 환불 <b>{cardWon.toLocaleString("ko-KR")}원</b>{" "}
                      <span className="text-zinc-500">— 카드로 충전한 금액은 결제한 카드로 취소해 드립니다.</span>
                    </li>
                    {bankWon > 0 && (
                      <li className="text-amber-700">
                        · 포인트 환불 <b>{bankWon.toLocaleString("ko-KR")}원</b>{" "}
                        <span className="text-zinc-500">— 입력하신 계좌로 입금해 드립니다.</span>
                      </li>
                    )}
                  </ul>
                )}
                <p className="mt-1 text-xs text-zinc-500">
                  환불은 <b>보유 포인트 전액</b>으로만 신청됩니다. 승인되면 위 포인트가
                  차감되고 환불 금액이 {bankWon > 0 ? "입금" : "카드 결제 취소로 환불"}됩니다.
                </p>
                {cardWon > 0 && (
                  <ul className="mt-1.5 space-y-0.5 text-xs text-zinc-500">
                    <li>· 이미 사용하신 포인트는 환불되지 않으며, 남은 포인트만큼만 부분 취소됩니다.</li>
                    <li>· 카드 결제 취소는 카드사 사정에 따라 영업일 기준 3~7일 정도 걸릴 수 있습니다.</li>
                  </ul>
                )}
              </div>
              {/* 계좌 정보는 계좌로 받을 몫이 있을 때만 */}
              {bankWon > 0 && (
                <textarea
                  name="refundInfo"
                  required
                  rows={3}
                  placeholder="환불 받을 계좌 (은행 / 계좌번호 / 예금주) 와 연락처를 적어주세요"
                  aria-label="환불 정보"
                  className="w-full rounded-xl border border-black/10 bg-white px-3.5 py-3 outline-none focus:border-emerald-500"
                />
              )}
            </>
          ) : (
            <p className="rounded-lg bg-white px-3.5 py-3 text-sm text-zinc-500">
              환불 가능한 포인트가 없습니다. (보유 0P)
            </p>
          )}
        </div>
      )}

      <Honeypot />
      {siteKey && <Turnstile siteKey={siteKey} />}

      <button
        disabled={refund && !canRefund}
        className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-zinc-300"
      >
        <i className="fa-solid fa-paper-plane" aria-hidden /> 등록
      </button>
    </form>
  );
}
