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
            {/* 사업자 정보는 크롤링·사칭 방지를 위해 이미지로만 표시(app/api/footer-info) */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/api/footer-info?part=info"
              alt="사업자 정보"
              width={300}
              height={80}
              className="mt-3 h-auto max-w-full"
            />
          </div>
          <nav aria-label="하단 메뉴" className="flex flex-col gap-2 sm:items-end">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="hover:text-zinc-900">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="mt-8 border-t border-black/5 pt-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/api/footer-info?part=copy" alt="© GetUsim" width={260} height={20} className="h-auto max-w-full" />
        </div>
      </div>
    </footer>
  );
}
