import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/dashboard");

  return (
    <div className="flex flex-1 flex-col">
      <header className="glass-dark sticky top-0 z-40 text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/admin" className="flex items-center gap-2 font-mont text-lg font-extrabold">
            <i className="fa-solid fa-gauge-high text-emerald-400" aria-hidden /> GetUsim 관리자
          </Link>
          <nav aria-label="관리자 메뉴" className="flex items-center gap-1 text-sm">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 rounded-xl px-3 py-1.5 text-zinc-300 hover:bg-white/10 hover:text-white"
            >
              <i className="fa-solid fa-user" aria-hidden /> 사용자 화면
            </Link>
            <form action="/logout" method="POST">
              <button
                type="submit"
                className="flex items-center gap-2 rounded-xl px-3 py-1.5 text-zinc-300 hover:bg-white/10 hover:text-white"
              >
                <i className="fa-solid fa-right-from-bracket" aria-hidden /> 로그아웃
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  );
}
