"use client";

import { useState } from "react";
import { createInquiry } from "./actions";

const CATS = [
  { v: "USAGE", label: "사용문의", icon: "fa-circle-question" },
  { v: "REFUND", label: "환불문의", icon: "fa-rotate-left" },
  { v: "OTHER", label: "기타문의", icon: "fa-ellipsis" },
] as const;

export default function InquiryForm({ currentPoint }: { currentPoint: number }) {
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
                <p className="mt-1 text-xs text-zinc-500">
                  환불은 <b>보유 포인트 전액</b>으로만 신청됩니다. 승인되면 위 포인트가
                  차감됩니다.
                </p>
              </div>
              <textarea
                name="refundInfo"
                required
                rows={3}
                placeholder="환불 받을 계좌 (은행 / 계좌번호 / 예금주) 와 연락처를 적어주세요"
                aria-label="환불 정보"
                className="w-full rounded-xl border border-black/10 bg-white px-3.5 py-3 outline-none focus:border-emerald-500"
              />
            </>
          ) : (
            <p className="rounded-lg bg-white px-3.5 py-3 text-sm text-zinc-500">
              환불 가능한 포인트가 없습니다. (보유 0P)
            </p>
          )}
        </div>
      )}

      <button
        disabled={refund && !canRefund}
        className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-zinc-300"
      >
        <i className="fa-solid fa-paper-plane" aria-hidden /> 등록
      </button>
    </form>
  );
}
