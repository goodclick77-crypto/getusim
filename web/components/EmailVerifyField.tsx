"use client";

import { useRef, useState } from "react";

// 회원가입 이메일 입력 + 인증번호 받기/입력.
// enabled=false(발송 수단 미설정)면 이메일 칸만 보여준다.

export default function EmailVerifyField({
  defaultEmail,
  enabled,
}: {
  defaultEmail?: string;
  enabled: boolean;
}) {
  const emailRef = useRef<HTMLInputElement>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function send() {
    const email = emailRef.current?.value.trim() || "";
    if (!emailRef.current?.checkValidity() || !email) {
      setMsg({ ok: false, text: "이메일을 정확히 입력해주세요." });
      return;
    }
    setSending(true);
    setMsg(null);
    try {
      const res = await fetch("/api/register/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (data.ok) {
        setSent(true);
        setMsg({ ok: true, text: "인증번호를 보냈습니다. 메일함(스팸함 포함)을 확인해주세요." });
      } else {
        setMsg({ ok: false, text: data.error || "발송에 실패했습니다." });
      }
    } catch {
      setMsg({ ok: false, text: "발송에 실패했습니다. 잠시 후 다시 시도해주세요." });
    } finally {
      setSending(false);
    }
  }

  const box =
    "flex items-center gap-3 rounded-xl border border-black/10 bg-white/60 px-3.5 py-3 focus-within:border-emerald-500";

  return (
    <>
      <div className="flex gap-2">
        <label className={`${box} min-w-0 flex-1`}>
          <i className="fa-solid fa-envelope w-4 text-zinc-400" aria-hidden />
          <input
            ref={emailRef}
            name="email"
            type="email"
            placeholder="이메일 (아이디·비밀번호 찾기에 사용)"
            aria-label="이메일"
            defaultValue={defaultEmail}
            required
            className="w-full bg-transparent outline-none"
          />
        </label>
        {enabled && (
          <button
            type="button"
            onClick={send}
            disabled={sending}
            className="shrink-0 rounded-xl border border-emerald-600 px-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50"
          >
            {sending ? "발송 중…" : sent ? "재발송" : "인증번호 받기"}
          </button>
        )}
      </div>
      {enabled && (
        <label className={box}>
          <i className="fa-solid fa-key w-4 text-zinc-400" aria-hidden />
          <input
            name="emailCode"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            placeholder="이메일 인증번호 6자리"
            aria-label="이메일 인증번호"
            required
            className="w-full bg-transparent outline-none"
          />
        </label>
      )}
      {msg && (
        <p role="status" className={`px-1 text-xs ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>
          {msg.text}
        </p>
      )}
    </>
  );
}
