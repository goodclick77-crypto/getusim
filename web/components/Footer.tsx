import Link from "next/link";

const LINKS = [
  { href: "/terms", label: "이용약관" },
  { href: "/privacy", label: "개인정보처리방침" },
  { href: "/faq", label: "FAQ" },
  { href: "/inquiry", label: "1:1 문의" },
];

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-black/5 bg-white/40 px-5 py-10 text-sm text-zinc-500 backdrop-blur">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-mont text-lg font-extrabold tracking-tight text-zinc-800">
              GetUsim
            </p>
            <p className="mt-2 max-w-md leading-relaxed text-zinc-500">
              글로벌 가상번호 SMS 인증 서비스. 전 세계 23개국의 번호로 인증번호를
              즉시 수신하세요.
            </p>
            <p className="mt-3 text-xs text-zinc-400">
              고객센터는 로그인 후 1:1 문의를 이용해 주세요.
            </p>
          </div>
          <nav aria-label="하단 메뉴" className="flex flex-col gap-2 sm:items-end">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="hover:text-zinc-900">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <p className="font-num mt-8 border-t border-black/5 pt-6 text-xs text-zinc-400">
          © {new Date().getFullYear()} GetUsim. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
