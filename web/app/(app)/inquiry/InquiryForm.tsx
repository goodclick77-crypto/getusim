"use client";

import { useState } from "react";
import { createInquiry } from "./actions";

const CATS = [
  { v: "USAGE", label: "사용문의", icon: "fa-circle-question" },
  { v: "REFUND", label: "환불문의", icon: "fa-rotate-left" },
] as const;

export default function InquiryForm({ currentPoint }: { currentPoint: number }) {
  const [category, setCategory] = useState<"USAGE" | "REFUND">("USAGE");
  const refund = category === "REFUND";

  return (
    <form action={createInquiry} className="space-y-3">
      {/* 분류 선택 */}
      <div className="flex gap-2">
        {CATS.map((c) => (
          <label
            key={c.v}
            className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
              category === c.v
                ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                : "border-black/10 text-zinc-600 hover:bg-black/[0.02]"
            }`}
          >
            <input
              type="radio"
              name="category"
              value={c.v}
              checked={category === c.v}
              onChange={() => setCategory(c.v)}
              className="sr-only"
            />
            <i className={`fa-solid ${c.icon}`} aria-hidden /> {c.label}
          </label>
        ))}
      </div>

      <input
        name="title"
        placeholder="제목"
        aria-label="제목"
        className="w-full rounded-xl border border-black/10 bg-white/60 px-3.5 py-3 outline-none focus:border-emerald-500"
      />
      <textarea
        name="content"
        placeholder={refund ? "환불 사유를 적어주세요" : "내용"}
        rows={4}
        aria-label="내용"
        className="w-full rounded-xl border border-black/10 bg-white/60 px-3.5 py-3 outline-none focus:border-emerald-500"
      />

      {/* 환불 신청 정보 */}
      {refund && (
        <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
          <p className="text-sm font-semibold text-emerald-700">환불 신청 정보</p>
          <div>
            <label className="mb-1 block text-xs text-zinc-500">환불할 포인트</label>
            <input
              name="refundPoint"
              type="number"
              min={1}
              max={currentPoint}
              placeholder="환불할 포인트 (숫자)"
              aria-label="환불할 포인트"
              className="w-full rounded-xl border border-black/10 bg-white px-3.5 py-3 outline-none focus:border-emerald-500"
            />
            <p className="mt-1 text-xs text-zinc-500">
              현재 보유 {currentPoint.toLocaleString("ko-KR")}P · 환불 승인 시 이 포인트가
              차감됩니다.
            </p>
          </div>
          <textarea
            name="refundInfo"
            rows={3}
            placeholder="환불 받을 계좌 (은행 / 계좌번호 / 예금주) 와 연락처를 적어주세요"
            aria-label="환불 정보"
            className="w-full rounded-xl border border-black/10 bg-white px-3.5 py-3 outline-none focus:border-emerald-500"
          />
        </div>
      )}

      <button className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white transition hover:bg-emerald-500">
        <i className="fa-solid fa-paper-plane" aria-hidden /> 등록
      </button>
    </form>
  );
}
