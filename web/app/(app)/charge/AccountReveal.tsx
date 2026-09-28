"use client";

import { useState } from "react";
import CopyButton from "@/components/CopyButton";

/**
 * 계좌번호는 버튼을 눌러야 불러온다. 불러오는 순간 서버(/api/bank-account/image)가
 * "계좌번호 확인"으로 기록 → 관리자 > 차단 내역 > 계좌 확인 후 미입금 에서 조회.
 */
export default function AccountReveal({ width, height }: { width: number; height: number }) {
  const [shown, setShown] = useState(false);

  if (!shown) {
    return (
      <button
        type="button"
        onClick={() => setShown(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700"
      >
        <i className="fa-solid fa-eye" aria-hidden /> 입금 계좌 확인하기
      </button>
    );
  }

  return (
    <>
      {/* 계좌번호는 텍스트로 싣지 않고 이미지로만 표시한다(크롤링 → 보이스피싱 악용 방지).
          alt 에도 번호를 넣지 않는다 — 스크린리더 사용자는 복사 버튼으로 받는다. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/api/bank-account/image"
        alt="입금 계좌번호 (옆의 복사 버튼으로 복사할 수 있습니다)"
        width={width}
        height={height}
        draggable={false}
        className="h-auto min-w-0 max-w-full select-none"
      />
      <CopyButton src="/api/bank-account" label="복사" className="border border-black/10" />
    </>
  );
}
