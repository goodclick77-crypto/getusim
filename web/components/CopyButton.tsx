"use client";

import { useState } from "react";

export default function CopyButton({
  text,
  className = "",
  label,
}: {
  text: string;
  className?: string;
  label?: string;
}) {
  const [done, setDone] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // 폴백
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {}
      document.body.removeChild(ta);
    }
    setDone(true);
    setTimeout(() => setDone(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label="복사"
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-medium transition ${
        done ? "text-emerald-600" : "text-zinc-500 hover:bg-black/5"
      } ${className}`}
    >
      <i className={`fa-solid ${done ? "fa-check" : "fa-copy"}`} aria-hidden />
      {label && <span>{done ? "복사됨" : label}</span>}
    </button>
  );
}
