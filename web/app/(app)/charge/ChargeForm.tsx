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
          : "횟수를 선택하세요"}
    </button>
  );
}

/**
 * 충전 폼 — 금액이 아니라 **인증 횟수** 단위로 고른다.
 *
 * 포인트 금액("+10,000P")으로 보여주면 회원이 쓸 만큼이 아니라 둥근 금액으로 충전하고,
 * 남은 포인트가 환불 문의로 돌아온다(환불의 대부분이 이 유형). "인증 3회"처럼 횟수로 보여주면
 * 필요한 만큼만 충전하게 되고 잔여 포인트가 구조적으로 줄어든다.
 * 내부 값은 그대로 포인트(hidden input `point`)라 서버·DB·자동입금매칭은 바뀌지 않는다.
 *
 * unitPoint = 인증 1회 기본 차감 포인트(SMS_BASE_POINT). 일부 비싼 국가·서비스는 1회에 더
 * 차감되므로 "기본 요금 기준"이라고 함께 안내한다.
 */
export default function ChargeForm({
  action,
  units,
  unitPoint,
  feeRate,
  defaultName,
}: {
  action: (formData: FormData) => void | Promise<void>;
  /** 누를 수 있는 횟수 단위(예: 1·3·5·10·50·100회) */
  units: number[];
  unitPoint: number;
  feeRate: number;
  defaultName: string;
}) {
  const [count, setCount] = useState(0);
  const point = count * unitPoint;
  const amount = Math.round(point * feeRate);

  return (
    <form action={action} className="space-y-4">
      {/* 횟수 단위 (누르면 누적) */}
      <div className="grid grid-cols-3 gap-2">
        {units.map((u) => (
          <button
            type="button"
            key={u}
            onClick={() => setCount((c) => c + u)}
            className="rounded-xl border border-black/10 bg-white/60 py-3 text-sm font-semibold transition hover:border-emerald-400 hover:bg-emerald-50 active:scale-95"
          >
            <span className="font-num">+{u.toLocaleString("ko-KR")}</span>회
            <span className="font-num mt-0.5 block text-[11px] font-normal text-zinc-400">
              {(u * unitPoint).toLocaleString("ko-KR")}P
            </span>
          </button>
        ))}
      </div>

      {/* 합계 */}
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-zinc-500">인증 횟수</span>
          <span className="font-num text-lg font-bold text-emerald-700">
            {count.toLocaleString("ko-KR")}회
            <span className="ml-1.5 text-sm font-medium text-emerald-600/80">
              ({point.toLocaleString("ko-KR")}P)
            </span>
          </span>
        </div>
        <div className="mt-1.5 flex items-center justify-between border-t border-emerald-200/70 pt-1.5">
          <span className="text-sm text-zinc-500">입금하실 금액</span>
          <span className="font-num text-xl font-bold">{amount.toLocaleString("ko-KR")}원</span>
        </div>
        {count > 0 && (
          <button
            type="button"
            onClick={() => setCount(0)}
            className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-100"
          >
            <i className="fa-solid fa-rotate-left text-[11px]" aria-hidden />
            초기화
          </button>
        )}
      </div>
      <p className="text-xs leading-relaxed text-zinc-500">
        <i className="fa-solid fa-circle-info mr-1" aria-hidden />
        기본 요금(1회 {unitPoint.toLocaleString("ko-KR")}P) 기준 횟수예요. 일부 국가·서비스는 1회에
        더 차감될 수 있고, 인증코드를 받지 못한 건은 차감되지 않아요.
      </p>

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

      <SubmitButton amount={amount} disabled={count <= 0} />
    </form>
  );
}
