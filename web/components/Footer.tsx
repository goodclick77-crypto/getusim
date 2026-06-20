import Link from "next/link";

const LINKS = [
  { href: "/about", label: "사이트정보" },
  { href: "/terms", label: "이용약관" },
  { href: "/privacy", label: "개인정보처리방침" },
  { href: "/faq", label: "FAQ" },
];

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-black/5 px-5 py-8 text-center text-sm text-zinc-500">
      <nav aria-label="하단 메뉴" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="hover:text-zinc-900">
            {l.label}
          </Link>
        ))}
      </nav>
      <p className="font-num mt-4 text-xs text-zinc-400">
        © {new Date().getFullYear()} GetUsim. All rights reserved.
      </p>
    </footer>
  );
}
