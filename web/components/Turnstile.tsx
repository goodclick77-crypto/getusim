"use client";

import { useEffect, useRef } from "react";

// Cloudflare Turnstile 위젯. 감싸는 <form> 안에 넣으면 제출 시
// hidden 필드 "cf-turnstile-response" 가 함께 전송된다.
// 클라이언트 라우팅으로 다시 들어와도 그려지도록 명시적 render 방식을 쓴다.

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loading: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = SRC;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => {
        loading = null;
        reject(new Error("turnstile load failed"));
      };
      document.head.appendChild(s);
    });
  }
  return loading;
}

export default function Turnstile({ siteKey }: { siteKey: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let id: string | null = null;
    let alive = true;
    loadScript()
      .then(() => {
        if (!alive || !ref.current || !window.turnstile) return;
        id = window.turnstile.render(ref.current, { sitekey: siteKey, language: "ko" });
      })
      .catch(() => {});
    return () => {
      alive = false;
      if (id && window.turnstile) window.turnstile.remove(id);
    };
  }, [siteKey]);

  return <div ref={ref} className="min-h-[65px]" />;
}
