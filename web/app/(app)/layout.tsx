import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { pt } from "@/lib/format";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/dashboard", label: "대시보드" },
  { href: "/sms", label: "SMS 인증" },
  { href: "/charge", label: "포인트 충전" },
  { href: "/inquiry", label: "1:1 문의" },
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
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-3">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="text-lg font-bold">
            GetUsim
          </Link>
          <nav className="hidden gap-1 sm:flex">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="rounded-lg px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="rounded-lg bg-emerald-50 px-3 py-1.5 font-medium text-emerald-700">
            {pt(user.point)}
          </span>
          {user.role === "ADMIN" && (
            <Link href="/admin" className="text-zinc-500 hover:text-zinc-900">
              관리자
            </Link>
          )}
          <span className="text-zinc-500">{user.name || user.loginId}님</span>
          <Link href="/logout" className="text-zinc-500 hover:text-zinc-900">
            로그아웃
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
