"use client";

import { useState } from "react";
import Link from "next/link";

type Item = { href: string; label: string; icon: string };

/** 모바일 햄버거 → 슬라이드 메뉴 */
export default function MobileNav({
  items,
  isAdmin,
}: {
  items: Item[];
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label="메뉴 열기"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="grid h-10 w-10 place-items-center rounded-xl text-zinc-700 hover:bg-black/5"
      >
        <i className="fa-solid fa-bars text-lg" aria-hidden />
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <nav
            aria-label="모바일 메뉴"
            className="glass absolute right-0 top-0 flex h-full w-72 flex-col gap-1 p-5"
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="font-mont text-lg font-bold">GetUsim</span>
              <button
                type="button"
                aria-label="메뉴 닫기"
                onClick={() => setOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-lg hover:bg-black/5"
              >
                <i className="fa-solid fa-xmark text-lg" aria-hidden />
              </button>
            </div>
            {items.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-zinc-700 hover:bg-black/5"
              >
                <i className={`fa-solid ${n.icon} w-5 text-emerald-600`} aria-hidden />
                {n.label}
              </Link>
            ))}
            {isAdmin && (
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-zinc-700 hover:bg-black/5"
              >
                <i className="fa-solid fa-gauge-high w-5 text-zinc-500" aria-hidden />
                관리자
              </Link>
            )}
            <form action="/logout" method="POST" className="mt-auto">
              <button
                type="submit"
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-red-600 hover:bg-red-50"
              >
                <i className="fa-solid fa-right-from-bracket w-5" aria-hidden />
                로그아웃
              </button>
            </form>
          </nav>
        </div>
      )}
    </div>
  );
}
