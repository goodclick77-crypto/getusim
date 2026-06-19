import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 bg-white">
        <span className="text-xl font-bold tracking-tight">GetUsim</span>
        <nav className="flex gap-2 text-sm">
          <Link href="/login" className="px-4 py-2 rounded-lg hover:bg-zinc-100">
            로그인
          </Link>
          <Link
            href="/register"
            className="px-4 py-2 rounded-lg bg-zinc-900 text-white hover:bg-zinc-700"
          >
            회원가입
          </Link>
        </nav>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          글로벌 SMS 인증, <span className="text-emerald-600">GetUsim</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-zinc-600">
          전 세계 가상번호로 SMS 인증번호를 받아보세요. 포인트를 충전하고 원하는
          서비스의 인증번호를 즉시 수신합니다.
        </p>
        <div className="mt-10 flex gap-3">
          <Link
            href="/register"
            className="rounded-xl bg-emerald-600 px-6 py-3 font-medium text-white hover:bg-emerald-500"
          >
            시작하기
          </Link>
          <Link
            href="/login"
            className="rounded-xl border border-zinc-300 px-6 py-3 font-medium hover:bg-zinc-100"
          >
            로그인
          </Link>
        </div>
      </main>

      <footer className="border-t border-zinc-200 px-6 py-6 text-center text-sm text-zinc-500">
        © {new Date().getFullYear()} GetUsim. All rights reserved.
      </footer>
    </div>
  );
}
