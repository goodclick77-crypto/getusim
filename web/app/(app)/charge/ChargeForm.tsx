"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

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

export default function ChargeForm({
  action,
  units,
  feeRate,
  defaultName,
}: {
  action: (formData: FormData) => void | Promise<void>;
  units: number[];
  feeRate: number;
  defaultName: string;
}) {
  const [point, setPoint] = useState(0);
  const amount = Math.round(point * feeRate);

  return (
    <form action={action} className="space-y-4">
      {/* 금액 단위 (누르면 누적) */}
      <div className="grid grid-cols-3 gap-2">
        {units.map((u) => (
          <button
            type="button"
            key={u}
            onClick={() => setPoint((p) => p + u)}
            className="font-num rounded-xl border border-black/10 bg-white/60 py-3 text-sm font-semibold transition hover:border-emerald-400 hover:bg-emerald-50 active:scale-95"
          >
            +{u.toLocaleString("ko-KR")}P
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
          <span className="text-sm text-zinc-500">입금하실 금액</span>
          <span className="font-num text-xl font-bold">{amount.toLocaleString("ko-KR")}원</span>
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

      {/* 입금자명 */}
      <div className="space-y-2">
        <label htmlFor="depositName" className="block text-sm font-semibold text-zinc-700">
          입금자명
        </label>
        <input
          id="depositName"
          name="depositName"
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
    </form>
  );
}
