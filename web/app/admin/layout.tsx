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
      <header className="flex items-center justify-between border-b border-zinc-200 bg-zinc-900 px-6 py-3 text-white">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="text-lg font-bold">
            GetUsim 관리자
          </Link>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/dashboard" className="text-zinc-300 hover:text-white">
            사용자 화면
          </Link>
          <Link href="/logout" className="text-zinc-300 hover:text-white">
            로그아웃
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
