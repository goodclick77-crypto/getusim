import Link from "next/link";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  empty: "이메일을 입력하세요.",
  rate: "시도가 너무 많습니다. 잠시 후 다시 시도해주세요.",
};

export default async function FindIdPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;
  return (
    <main id="main" className="flex flex-1 items-center justify-center px-5 py-16">
      <div className="glass w-full max-w-sm rounded-3xl p-8">
        <Link href="/" className="block text-center font-mont text-2xl font-extrabold">
          GetUsim
        </Link>
        <h1 className="mt-7 flex items-center gap-2 text-lg font-bold">
          <i className="fa-solid fa-id-card text-emerald-600" aria-hidden /> 아이디 찾기
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          가입 시 등록한 <b>이메일</b>을 입력하면, 그 이메일로 아이디를 보내드립니다.
        </p>

        {sent ? (
          <div className="mt-4 rounded-xl bg-emerald-50 px-4 py-4 text-sm text-emerald-700">
            <p className="flex items-center gap-2 font-semibold">
              <i className="fa-solid fa-envelope-circle-check" aria-hidden /> 메일을 보냈습니다.
            </p>
            <p className="mt-1.5 leading-relaxed text-emerald-700/90">
              입력한 이메일로 가입된 계정이 있으면 아이디가 도착합니다. 받은편지함과 스팸함을
              확인하세요.
            </p>
          </div>
        ) : (
          <>
            {error && (
              <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">
                {ERRORS[error] ?? "요청 처리에 실패했습니다."}
              </p>
            )}
            <form action="/api/find-id" method="POST" className="mt-5 space-y-3">
              <label className="flex items-center gap-3 rounded-xl border border-black/10 bg-white/60 px-3.5 py-3 focus-within:border-emerald-500">
                <i className="fa-solid fa-envelope w-4 text-zinc-400" aria-hidden />
                <input
                  name="email"
                  type="email"
                  placeholder="가입 이메일"
                  aria-label="가입 이메일"
                  className="w-full bg-transparent outline-none"
                />
              </label>
              <button className="w-full rounded-xl bg-emerald-600 py-3 font-semibold text-white transition hover:bg-emerald-500">
                아이디 메일 받기
              </button>
            </form>
          </>
        )}

        <p className="mt-5 text-center text-sm text-zinc-500">
          <Link href="/find-password" className="text-emerald-600">
            비밀번호 찾기
          </Link>
          <span className="mx-2 text-zinc-300">|</span>
          <Link href="/login" className="hover:text-zinc-900">
            로그인
          </Link>
        </p>
      </div>
    </main>
  );
}
