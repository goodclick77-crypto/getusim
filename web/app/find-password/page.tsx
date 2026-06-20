import Link from "next/link";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  empty: "모든 항목을 입력하세요.",
  nomatch: "일치하는 회원 정보가 없습니다. (아이디·이메일·휴대폰 확인)",
  expired: "재설정 시간이 만료되었습니다. 다시 시도해주세요.",
};

export default async function FindPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main id="main" className="flex flex-1 items-center justify-center px-5 py-16">
      <div className="glass w-full max-w-sm rounded-3xl p-8">
        <Link href="/" className="block text-center font-mont text-2xl font-extrabold">
          GetUsim
        </Link>
        <h1 className="mt-7 flex items-center gap-2 text-lg font-bold">
          <i className="fa-solid fa-key text-emerald-600" aria-hidden /> 비밀번호 찾기
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          가입 시 등록한 아이디·이메일·휴대폰으로 본인확인 후 재설정합니다.
        </p>
        {error && (
          <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">
            {ERRORS[error] ?? "본인확인에 실패했습니다."}
          </p>
        )}
        <form action="/api/find-password" method="POST" className="mt-5 space-y-3">
          <Field name="loginId" placeholder="아이디" icon="fa-user" />
          <Field name="email" type="email" placeholder="이메일" icon="fa-envelope" />
          <Field name="phone" placeholder="휴대폰 번호" icon="fa-mobile-screen" />
          <button className="w-full rounded-xl bg-emerald-600 py-3 font-semibold text-white transition hover:bg-emerald-500">
            본인확인
          </button>
        </form>
        <p className="mt-5 text-center text-sm text-zinc-500">
          <Link href="/login" className="text-emerald-600">
            로그인으로 돌아가기
          </Link>
        </p>
      </div>
    </main>
  );
}

function Field({
  name,
  placeholder,
  icon,
  type = "text",
}: {
  name: string;
  placeholder: string;
  icon: string;
  type?: string;
}) {
  return (
    <label className="flex items-center gap-3 rounded-xl border border-black/10 bg-white/60 px-3.5 py-3 focus-within:border-emerald-500">
      <i className={`fa-solid ${icon} w-4 text-zinc-400`} aria-hidden />
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full bg-transparent outline-none"
      />
    </label>
  );
}
