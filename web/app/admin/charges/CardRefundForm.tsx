"use client";

import { useState } from "react";
import { chargeAmount } from "@/lib/config";

/**
 * 카드 충전 환불 입력 — 환불할 포인트를 정하면 취소될 카드 금액을 바로 보여준다.
 * 금액 계산은 서버(cardRefundPlan)와 같은 식: 누적 포인트 기준, 마지막 환불은 결제액의 나머지.
 * 최종 금액은 서버가 다시 계산하므로 여기 값은 안내용이다.
 */
export default function CardRefundForm({
  action,
  id,
  loginId,
  max,
  chargePoint,
  amount,
  prevPoint,
  prevAmount,
}: {
  action: (formData: FormData) => Promise<void>;
  id: number;
  loginId: string;
  /** 이번에 환불 가능한 최대 포인트(남은 충전분과 보유 포인트 중 작은 쪽) */
  max: number;
  chargePoint: number;
  amount: number;
  prevPoint: number;
  prevAmount: number;
}) {
  const [point, setPoint] = useState(max);
  const valid = Number.isInteger(point) && point > 0 && point <= max;
  const full = valid && prevPoint + point >= chargePoint;
  const won = valid ? (full ? amount : chargeAmount(prevPoint + point)) - prevAmount : 0;

  return (
    <details className="relative">
      <summary className="cursor-pointer list-none whitespace-nowrap rounded-lg border border-red-200 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50">
        환불
      </summary>
      <form
        action={action}
        onSubmit={(e) => {
          if (
            !valid ||
            !confirm(
              `${loginId} 회원의 카드 충전을 ${full ? "전액" : "부분"} 환불할까요?\n\n포인트 ${point.toLocaleString("ko-KR")}P 회수 + 카드 결제 ${won.toLocaleString("ko-KR")}원 취소\n\n되돌릴 수 없습니다.`,
            )
          ) {
            e.preventDefault();
          }
        }}
        className="absolute right-0 z-20 mt-1.5 w-60 space-y-2 rounded-xl border border-black/10 bg-white p-3 text-left text-xs shadow-lg"
      >
        <input type="hidden" name="id" value={id} />
        <label className="block text-zinc-500">
          환불할 포인트 (최대 {max.toLocaleString("ko-KR")}P)
          <input
            name="point"
            type="number"
            inputMode="numeric"
            min={1}
            max={max}
            step={1}
            value={Number.isNaN(point) ? "" : point}
            onChange={(e) => setPoint(e.target.valueAsNumber)}
            className="font-num mt-1 w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm text-zinc-900 outline-none focus:border-red-400"
          />
        </label>
        {max < chargePoint - prevPoint && (
          <p className="leading-snug text-zinc-400">회원이 이미 쓴 포인트는 환불할 수 없어 보유 포인트까지만 가능합니다.</p>
        )}
        <p className="flex justify-between">
          <span className="text-zinc-500">카드 취소 금액</span>
          <span className="font-num font-bold text-red-600">{valid ? `${won.toLocaleString("ko-KR")}원` : "-"}</span>
        </p>
        <button
          disabled={!valid}
          className="w-full rounded-lg bg-red-600 px-3 py-1.5 font-semibold text-white hover:bg-red-500 disabled:opacity-40"
        >
          {full ? "전액 환불" : "부분 환불"}
        </button>
      </form>
    </details>
  );
}
