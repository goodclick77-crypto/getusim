"use client";

import { useState } from "react";

/**
 * 복사 버튼.
 * - text: 복사할 문자열을 바로 넘긴다.
 * - src : 누를 때 이 URL에서 받아온 텍스트를 복사한다. 계좌번호처럼 페이지 HTML에
 *         텍스트로 싣고 싶지 않은 값에 쓴다.
 */
export default function CopyButton({
  text,
  src,
  className = "",
  label,
}: {
  text?: string;
  src?: string;
  className?: string;
  label?: string;
}) {
  const [state, setState] = useState<"idle" | "done" | "fail">("idle");

  async function fetchText() {
    const r = await fetch(src!, { cache: "no-store" });
    if (!r.ok) throw new Error(String(r.status));
    return r.text();
  }

  async function copy() {
    let ok = true;
    try {
      if (src && typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        // Safari 는 await 뒤의 clipboard 쓰기를 사용자 제스처 밖으로 보고 막는다.
        // Promise 를 ClipboardItem 에 바로 넘기면 제스처 안에서 쓰기가 시작된다.
        const blob = fetchText().then((t) => new Blob([t], { type: "text/plain" }));
        await navigator.clipboard.write([new ClipboardItem({ "text/plain": blob })]);
      } else {
        await navigator.clipboard.writeText(src ? await fetchText() : text!);
      }
    } catch {
      // 폴백
      try {
        const value = src ? await fetchText() : text!;
        const ta = document.createElement("textarea");
        ta.value = value;
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {
        ok = false;
      }
    }
    setState(ok ? "done" : "fail");
    setTimeout(() => setState("idle"), 1500);
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label="복사"
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-medium transition ${
        state === "done" ? "text-emerald-600" : state === "fail" ? "text-red-500" : "text-zinc-500 hover:bg-black/5"
      } ${className}`}
    >
      <i
        className={`fa-solid ${state === "done" ? "fa-check" : state === "fail" ? "fa-xmark" : "fa-copy"}`}
        aria-hidden
      />
      {label && <span>{state === "done" ? "복사됨" : state === "fail" ? "실패" : label}</span>}
    </button>
  );
}
