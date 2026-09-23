import Link from "next/link";
import { COMPANY } from "@/lib/company";

const LINKS = [
  { href: "/terms", label: "이용약관" },
  { href: "/privacy", label: "개인정보처리방침" },
  { href: "/refund", label: "환불규정" },
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
              {COMPANY.brand}
            </p>
            {/* 전자상거래법 제10조 통신판매업자 표시사항: 상호·대표자·사업자등록번호·
                통신판매업신고번호·주소·연락처. PG 심사 시에도 이 표기를 확인한다. */}
            <address className="mt-3 space-y-0.5 text-xs not-italic leading-relaxed text-zinc-500">
              <p>
                상호 : {COMPANY.name} ({COMPANY.brand}) | 대표자 : {COMPANY.ceo}
              </p>
              <p className="font-num">사업자등록번호 : {COMPANY.bizNo}</p>
              <p className="font-num">
                통신판매업신고번호 : {COMPANY.mailOrderNo || "신고 준비 중"}
              </p>
              <p>주소 : {COMPANY.address}</p>
              <p className="font-num">
                고객센터 :{" "}
                <a href={`tel:${COMPANY.phone.replace(/-/g, "")}`} className="hover:text-zinc-700">
                  {COMPANY.phone}
                </a>{" "}
                ({COMPANY.supportHours})
              </p>
              <p>
                E-mail :{" "}
                <a href={`mailto:${COMPANY.email}`} className="hover:text-zinc-700">
                  {COMPANY.email}
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
          © {new Date().getFullYear()} {COMPANY.brand}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
