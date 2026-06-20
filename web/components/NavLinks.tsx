"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string; icon: string };

/** 현재 경로를 강조하는 데스크톱 내비 */
export default function NavLinks({ items }: { items: Item[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="주 메뉴" className="hidden gap-1 lg:flex">
      {items.map((n) => {
        const active = pathname === n.href || pathname.startsWith(n.href + "/");
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition ${
              active
                ? "bg-emerald-600/10 font-semibold text-emerald-700"
                : "text-zinc-600 hover:bg-black/5 hover:text-zinc-900"
            }`}
          >
            <i className={`fa-solid ${n.icon} ${active ? "text-emerald-600" : "text-emerald-600/70"}`} aria-hidden />
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
