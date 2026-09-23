import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { bal } from "@/lib/format";
import MobileNav from "@/components/MobileNav";
import NavLinks from "@/components/NavLinks";
import Footer from "@/components/Footer";
import { cardPaymentAvailable } from "@/lib/payments";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/dashboard", label: "대시보드", icon: "fa-gauge" },
  { href: "/products", label: "상품", icon: "fa-bag-shopping" },
  { href: "/sms", label: "SMS 인증", icon: "fa-comment-sms" },
  { href: "/charge", label: "잔액 충전", icon: "fa-coins" },
  { href: "/notice", label: "공지사항", icon: "fa-bullhorn" },
  { href: "/faq", label: "FAQ", icon: "fa-circle-question" },
  { href: "/inquiry", label: "1:1 문의", icon: "fa-headset" },
  { href: "/account", label: "내 정보", icon: "fa-user" },
];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // 건별 결제(결제사 설정)가 되는 환경에서는 "잔액 충전" 메뉴를 숨긴다 — 결제는 주문 페이지에서.
  // 운영은 PG 승인 전까지 무통장 충전이 유일한 결제수단이라 메뉴가 그대로 남는다.
  const cardPay = cardPaymentAvailable();
  const nav = cardPay ? NAV.filter((n) => n.href !== "/charge") : NAV;

  return (
    <div className="flex flex-1 flex-col">
      <header className="glass sticky top-7 z-40">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-4">
            <Link href="/" className="font-mont text-lg font-extrabold tracking-tight">
              GetUsim
            </Link>
            <NavLinks items={nav} />
          </div>

          <div className="flex shrink-0 items-center gap-2 text-sm">
            <Link
              href={cardPay ? "/history?tab=point" : "/charge"}
              className="rounded-xl bg-emerald-600/10 px-3 py-1.5 font-semibold text-emerald-700 hover:bg-emerald-600/15"
              title={cardPay ? "잔액 내역" : "잔액 충전"}
            >
              <i className="fa-solid fa-coins mr-1.5" aria-hidden />
              <span className="font-num">{bal(user.point)}</span>
            </Link>
            {user.role === "ADMIN" && (
              <Link
                href="/admin"
                className="hidden items-center gap-1.5 rounded-xl bg-zinc-900 px-3 py-1.5 font-medium text-white hover:bg-zinc-700 xl:inline-flex"
              >
                <i className="fa-solid fa-gauge-high" aria-hidden /> 관리자
              </Link>
            )}
            <form action="/logout" method="POST" className="hidden xl:block">
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-xl border border-black/10 px-3 py-1.5 text-zinc-600 transition hover:bg-black/5 hover:text-zinc-900"
              >
                <i className="fa-solid fa-right-from-bracket" aria-hidden /> 로그아웃
              </button>
            </form>
            <MobileNav items={nav} isAdmin={user.role === "ADMIN"} />
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {children}
      </main>
      <Footer />
    </div>
  );
}
