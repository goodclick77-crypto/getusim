import Link from "next/link";
import { getCurrentUser } from "@/lib/session";

/** 비회원도 보는 공개 페이지(상품·가격표) 공용 헤더 */
export default async function PublicHeader({ active }: { active?: "products" }) {
  const user = await getCurrentUser();
  const tab = (href: string, label: string, on: boolean) => (
    <Link
      href={href}
      className={`rounded-xl px-2.5 py-2 font-medium sm:px-3 ${on ? "bg-black/5 text-zinc-900" : "hover:bg-black/5"}`}
    >
      {label}
    </Link>
  );
  return (
    <header className="glass sticky top-7 z-40">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-3.5 sm:px-6">
        <div className="flex items-center gap-1 sm:gap-3">
          <Link href="/" className="font-mont text-lg font-extrabold tracking-tight sm:text-xl">
            GetUsim
          </Link>
          <nav className="ml-2 flex items-center gap-0.5 text-sm">
            {tab("/products", "상품", active === "products")}
          </nav>
        </div>
        <nav className="flex items-center gap-1 text-sm sm:gap-2">
          {user ? (
            <Link
              href="/dashboard"
              className="rounded-xl bg-zinc-900 px-3 py-2 font-medium text-white transition hover:bg-zinc-700 sm:px-4"
            >
              내 계정
            </Link>
          ) : (
            <>
              <Link href="/login" className="rounded-xl px-2.5 py-2 font-medium hover:bg-black/5 sm:px-4">
                로그인
              </Link>
              <Link
                href="/register"
                className="rounded-xl bg-zinc-900 px-3 py-2 font-medium text-white transition hover:bg-zinc-700 sm:px-4"
              >
                회원가입
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
