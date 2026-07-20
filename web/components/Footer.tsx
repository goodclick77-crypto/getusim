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
            <address className="mt-3 space-y-0.5 text-xs not-italic leading-relaxed text-zinc-500">
              <p>겟유심 | 대표자 : 엄전혜</p>
              <p>사업자등록번호 : 843-08-01310</p>
              <p>주소 : 경기도 양주시 고읍남로39번길 48</p>
              <p>
                E-mail :{" "}
                <a href="mailto:ejh0938@naver.com" className="hover:text-zinc-700">
                  ejh0938@naver.com
                </a>
              </p>
            </address>
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
