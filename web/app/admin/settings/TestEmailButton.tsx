"use client";

import { useState } from "react";

export default function TestEmailButton({ to }: { to: string }) {
  const [state, setState] = useState<"idle" | "sending" | "ok" | "fail">("idle");
  const [msg, setMsg] = useState("");
  const [target, setTarget] = useState("");

  async function send() {
    setState("sending");
    setMsg("");
    const dest = target.trim();
    try {
      const url = dest
        ? `/api/admin/test-email?to=${encodeURIComponent(dest)}`
        : "/api/admin/test-email";
      const res = await fetch(url, { method: "POST" });
      const j = await res.json();
      if (j.ok) {
        setState("ok");
        setMsg(`${dest || to} 으로 테스트 메일을 보냈습니다. 수신함(스팸함 포함)을 확인하세요.`);
      } else {
        setState("fail");
        setMsg(j.error || "발송에 실패했습니다.");
      }
    } catch {
      setState("fail");
      setMsg("요청 중 오류가 발생했습니다.");
    }
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="email"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder={`받는 주소 (비우면 관리자 ${to})`}
          aria-label="테스트 받는 주소"
          className="min-w-0 flex-1 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
        />
        <button
          type="button"
          onClick={send}
          disabled={state === "sending"}
          className="inline-flex items-center gap-2 rounded-xl border border-black/10 px-4 py-2 text-sm font-medium transition hover:bg-black/5 disabled:opacity-50"
        >
          <i
            className={`fa-solid ${state === "sending" ? "fa-spinner fa-spin" : "fa-paper-plane"}`}
            aria-hidden
          />
          {state === "sending" ? "보내는 중…" : "테스트 메일 보내기"}
        </button>
      </div>
      {state === "ok" && (
        <p className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          <i className="fa-solid fa-circle-check" aria-hidden /> {msg}
        </p>
      )}
      {state === "fail" && (
        <p className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          <i className="fa-solid fa-circle-exclamation" aria-hidden /> {msg}
        </p>
      )}
    </div>
  );
}
