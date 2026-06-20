import Link from "next/link";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  empty: "아이디와 비밀번호를 입력하세요.",
  invalid: "아이디 또는 비밀번호가 올바르지 않습니다.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; id?: string; reset?: string }>;
}) {
  const { error, id, reset } = await searchParams;
  return (
    <main id="main" className="flex flex-1 items-center justify-center px-5 py-16">
      <div className="glass w-full max-w-sm rounded-3xl p-8">
        <Link href="/" className="block text-center font-mont text-2xl font-extrabold">
          GetUsim
        </Link>
        <h1 className="mt-7 flex items-center gap-2 text-lg font-bold">
          <i className="fa-solid fa-right-to-bracket text-emerald-600" aria-hidden /> 로그인
        </h1>
        {reset && (
          <p className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            <i className="fa-solid fa-circle-check" aria-hidden />
            비밀번호가 변경되었습니다. 새 비밀번호로 로그인하세요.
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="mt-3 flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600"
          >
            <i className="fa-solid fa-circle-exclamation" aria-hidden />
            {ERRORS[error] ?? "로그인에 실패했습니다."}
          </p>
        )}
        <form action="/api/login" method="POST" className="mt-5 space-y-3">
          <label className="flex items-center gap-3 rounded-xl border border-black/10 bg-white/60 px-3.5 py-3 focus-within:border-emerald-500">
            <i className="fa-solid fa-user w-4 text-zinc-400" aria-hidden />
            <input
              name="loginId"
              placeholder="아이디"
              autoComplete="username"
              aria-label="아이디"
              defaultValue={id}
              className="w-full bg-transparent outline-none"
            />
          </label>
          <label className="flex items-center gap-3 rounded-xl border border-black/10 bg-white/60 px-3.5 py-3 focus-within:border-emerald-500">
            <i className="fa-solid fa-lock w-4 text-zinc-400" aria-hidden />
            <input
              name="password"
              type="password"
              placeholder="비밀번호"
              autoComplete="current-password"
              aria-label="비밀번호"
              className="w-full bg-transparent outline-none"
            />
          </label>
          <button className="w-full rounded-xl bg-emerald-600 py-3 font-semibold text-white transition hover:bg-emerald-500">
            로그인
          </button>
        </form>
        <div className="mt-5 flex items-center justify-center gap-3 text-sm text-zinc-500">
          <Link href="/register" className="font-medium text-emerald-600">
            회원가입
          </Link>
          <span className="text-zinc-300">|</span>
          <Link href="/find-password" className="hover:text-zinc-900">
            비밀번호 찾기
          </Link>
        </div>
      </div>
    </main>
  );
}
