import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  short: "비밀번호는 6자 이상이어야 합니다.",
  mismatch: "비밀번호가 일치하지 않습니다.",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; error?: string }>;
}) {
  const { t, error } = await searchParams;
  if (!t) redirect("/find-password");

  return (
    <main id="main" className="flex flex-1 items-center justify-center px-5 py-16">
      <div className="glass w-full max-w-sm rounded-3xl p-8">
        <Link href="/" className="block text-center font-mont text-2xl font-extrabold">
          GetUsim
        </Link>
        <h1 className="mt-7 flex items-center gap-2 text-lg font-bold">
          <i className="fa-solid fa-lock text-emerald-600" aria-hidden /> 새 비밀번호 설정
        </h1>
        {error && (
          <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">
            {ERRORS[error] ?? "다시 시도해주세요."}
          </p>
        )}
        <form action="/api/reset-password" method="POST" className="mt-5 space-y-3">
          <input type="hidden" name="token" value={t} />
          <label className="flex items-center gap-3 rounded-xl border border-black/10 bg-white/60 px-3.5 py-3 focus-within:border-emerald-500">
            <i className="fa-solid fa-lock w-4 text-zinc-400" aria-hidden />
            <input
              name="password"
              type="password"
              placeholder="새 비밀번호 (6자 이상)"
              aria-label="새 비밀번호"
              className="w-full bg-transparent outline-none"
            />
          </label>
          <label className="flex items-center gap-3 rounded-xl border border-black/10 bg-white/60 px-3.5 py-3 focus-within:border-emerald-500">
            <i className="fa-solid fa-lock w-4 text-zinc-400" aria-hidden />
            <input
              name="passwordConfirm"
              type="password"
              placeholder="새 비밀번호 확인"
              aria-label="새 비밀번호 확인"
              className="w-full bg-transparent outline-none"
            />
          </label>
          <button className="w-full rounded-xl bg-emerald-600 py-3 font-semibold text-white transition hover:bg-emerald-500">
            비밀번호 변경
          </button>
        </form>
      </div>
    </main>
  );
}
