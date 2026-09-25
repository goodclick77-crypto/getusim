import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function LoginVerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; error?: string }>;
}) {
  const { c, error } = await searchParams;
  return (
    <main id="main" className="flex flex-1 items-center justify-center px-5 py-16">
      <div className="glass w-full max-w-sm rounded-3xl p-8">
        <Link href="/" className="block text-center font-mont text-2xl font-extrabold">
          GetUsim
        </Link>
        <h1 className="mt-7 flex items-center gap-2 text-lg font-bold">
          <i className="fa-solid fa-shield-halved text-emerald-600" aria-hidden /> 관리자 인증
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          관리자 이메일로 보낸 6자리 인증번호를 입력하세요. (5분간 유효)
        </p>
        {error && (
          <p
            role="alert"
            className="mt-3 flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600"
          >
            <i className="fa-solid fa-circle-exclamation" aria-hidden />
            인증번호가 올바르지 않습니다. (5회 틀리면 다시 로그인해야 합니다)
          </p>
        )}
        <form action="/api/login/verify" method="POST" className="mt-5 space-y-3">
          <input type="hidden" name="c" value={c || ""} />
          <label className="flex items-center gap-3 rounded-xl border border-black/10 bg-white/60 px-3.5 py-3 focus-within:border-emerald-500">
            <i className="fa-solid fa-key w-4 text-zinc-400" aria-hidden />
            <input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="인증번호 6자리"
              aria-label="인증번호"
              required
              autoFocus
              className="w-full bg-transparent outline-none"
            />
          </label>
          <button className="w-full rounded-xl bg-emerald-600 py-3 font-semibold text-white transition hover:bg-emerald-500">
            확인
          </button>
        </form>
        <p className="mt-5 text-center text-sm text-zinc-500">
          <Link href="/login" className="font-medium text-emerald-600">
            처음부터 다시 로그인
          </Link>
        </p>
      </div>
    </main>
  );
}
