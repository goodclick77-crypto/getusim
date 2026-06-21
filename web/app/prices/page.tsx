import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import Footer from "@/components/Footer";
import PriceBrowser from "./PriceBrowser";

export const dynamic = "force-dynamic";

export default async function PricesPage() {
  const user = await getCurrentUser();
  return (
    <div className="flex flex-1 flex-col">
      <header className="glass sticky top-0 z-40">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3.5">
          <Link href="/" className="font-mont text-xl font-extrabold tracking-tight">
            GetUsim
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            {user ? (
              <Link
                href="/sms"
                className="rounded-xl bg-zinc-900 px-4 py-2 font-medium text-white transition hover:bg-zinc-700"
              >
                번호 받기
              </Link>
            ) : (
              <>
                <Link href="/login" className="rounded-xl px-4 py-2 font-medium hover:bg-black/5">
                  로그인
                </Link>
                <Link
                  href="/register"
                  className="rounded-xl bg-zinc-900 px-4 py-2 font-medium text-white transition hover:bg-zinc-700"
                >
                  회원가입
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <i className="fa-solid fa-tags text-emerald-600" aria-hidden /> 실시간 가격표
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          국가·서비스별 실시간 수신률과 가격을 확인하세요. 회원가입 후 포인트를 충전하면 바로 번호를
          받을 수 있습니다.
        </p>

        <div className="mt-6">
          <PriceBrowser />
        </div>

        {!user && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 rounded-2xl bg-emerald-50 px-5 py-4 text-sm">
            <span className="text-emerald-800">가격을 확인하셨나요? 지금 시작해보세요.</span>
            <Link
              href="/register"
              className="rounded-xl bg-emerald-600 px-4 py-2 font-semibold text-white transition hover:bg-emerald-500"
            >
              회원가입
            </Link>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
