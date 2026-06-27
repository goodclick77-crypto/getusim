"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

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
  const pathname = usePathname();

  return (
    <div className="xl:hidden">
      <button
        type="button"
        aria-label="메뉴 열기"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="grid h-10 w-10 place-items-center rounded-xl border border-black/10 bg-white/80 text-zinc-900 shadow-sm transition hover:bg-white"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
          <line x1="4" y1="7" x2="20" y2="7" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="17" x2="20" y2="17" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <nav
            aria-label="모바일 메뉴"
            className="absolute right-0 top-0 flex h-full w-72 max-w-[85vw] flex-col gap-1 bg-white p-5 shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="font-mont text-lg font-bold">GetUsim</span>
              <button
                type="button"
                aria-label="메뉴 닫기"
                onClick={() => setOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-lg hover:bg-black/5"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="18" y1="6" x2="6" y2="18" />
                </svg>
              </button>
            </div>
            {items.map((n) => {
              const active = pathname === n.href || pathname.startsWith(n.href + "/");
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-xl px-3 py-3 text-[15px] transition ${
                    active
                      ? "bg-emerald-600/10 font-semibold text-emerald-700"
                      : "text-zinc-700 hover:bg-black/5"
                  }`}
                >
                  <i
                    className={`fa-solid ${n.icon} w-5 ${active ? "text-emerald-600" : "text-emerald-600/80"}`}
                    aria-hidden
                  />
                  {n.label}
                </Link>
              );
            })}
            {isAdmin && (
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className="mt-1 flex items-center gap-3 rounded-xl border border-black/10 px-3 py-3 text-[15px] font-medium text-zinc-700 hover:bg-black/5"
              >
                <i className="fa-solid fa-gauge-high w-5 text-zinc-500" aria-hidden />
                관리자
              </Link>
            )}
            <form action="/logout" method="POST" className="mt-auto">
              <button
                type="submit"
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-[15px] text-red-600 hover:bg-red-50"
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
