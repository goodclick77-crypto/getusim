import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { pt } from "@/lib/format";
import MobileNav from "@/components/MobileNav";
import Footer from "@/components/Footer";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/dashboard", label: "대시보드", icon: "fa-gauge" },
  { href: "/sms", label: "SMS 인증", icon: "fa-comment-sms" },
  { href: "/charge", label: "포인트 충전", icon: "fa-coins" },
  { href: "/notice", label: "공지사항", icon: "fa-bullhorn" },
  { href: "/faq", label: "FAQ", icon: "fa-circle-question" },
  { href: "/inquiry", label: "1:1 문의", icon: "fa-headset" },
];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex flex-1 flex-col">
      <header className="glass sticky top-0 z-40">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="font-mont text-lg font-extrabold tracking-tight">
              GetUsim
            </Link>
            <nav aria-label="주 메뉴" className="hidden gap-1 sm:flex">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-zinc-600 transition hover:bg-black/5 hover:text-zinc-900"
                >
                  <i className={`fa-solid ${n.icon} text-emerald-600`} aria-hidden />
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <span className="rounded-xl bg-emerald-600/10 px-3 py-1.5 font-semibold text-emerald-700">
              <i className="fa-solid fa-coins mr-1.5" aria-hidden />
              <span className="font-num">{pt(user.point)}</span>
            </span>
            {user.role === "ADMIN" && (
              <Link
                href="/admin"
                className="hidden items-center gap-1.5 rounded-xl bg-zinc-900 px-3 py-1.5 font-medium text-white hover:bg-zinc-700 sm:inline-flex"
              >
                <i className="fa-solid fa-gauge-high" aria-hidden /> 관리자
              </Link>
            )}
            <span className="hidden text-zinc-500 sm:inline">
              {user.name || user.loginId}님
            </span>
            <form action="/logout" method="POST" className="hidden sm:block">
              <button
                type="submit"
                className="rounded-xl px-3 py-1.5 text-zinc-500 hover:bg-black/5 hover:text-zinc-900"
                title="로그아웃"
              >
                <i className="fa-solid fa-right-from-bracket" aria-hidden />
              </button>
            </form>
            <MobileNav items={NAV} isAdmin={user.role === "ADMIN"} />
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {children}
      </main>
      <Footer />
    </div>
  );
}
