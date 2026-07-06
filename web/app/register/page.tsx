import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    loginId?: string;
    name?: string;
    email?: string;
  }>;
}) {
  const sp = await searchParams;

  const FIELDS = [
    { name: "loginId", placeholder: "아이디 (영문/숫자 3~20자)", type: "text", icon: "fa-user", def: sp.loginId, required: true },
    { name: "password", placeholder: "비밀번호 (6자 이상)", type: "password", icon: "fa-lock", def: "", required: true },
    { name: "passwordConfirm", placeholder: "비밀번호 확인", type: "password", icon: "fa-lock", def: "", required: true },
    { name: "name", placeholder: "이름", type: "text", icon: "fa-id-card", def: sp.name, required: true },
    { name: "email", placeholder: "이메일 (아이디·비밀번호 찾기에 사용)", type: "email", icon: "fa-envelope", def: sp.email, required: true },
  ];

  return (
    <main id="main" className="flex flex-1 items-center justify-center px-5 py-16">
      <div className="glass w-full max-w-sm rounded-3xl p-8">
        <Link href="/" className="block text-center font-mont text-2xl font-extrabold">
          GetUsim
        </Link>
        <h1 className="mt-7 flex items-center gap-2 text-lg font-bold">
          <i className="fa-solid fa-user-plus text-emerald-600" aria-hidden /> 회원가입
        </h1>
        {sp.error && (
          <p
            role="alert"
            className="mt-3 flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600"
          >
            <i className="fa-solid fa-circle-exclamation" aria-hidden />
            {sp.error}
          </p>
        )}
        <form action="/api/register" method="POST" className="mt-5 space-y-3">
          {FIELDS.map((f) => (
            <label
              key={f.name}
              className="flex items-center gap-3 rounded-xl border border-black/10 bg-white/60 px-3.5 py-3 focus-within:border-emerald-500"
            >
              <i className={`fa-solid ${f.icon} w-4 text-zinc-400`} aria-hidden />
              <input
                name={f.name}
                type={f.type}
                placeholder={f.placeholder}
                aria-label={f.placeholder}
                defaultValue={f.def}
                required={f.required}
                className="w-full bg-transparent outline-none"
              />
            </label>
          ))}

          <p className="flex items-start gap-1.5 px-1 text-xs text-zinc-500">
            <i className="fa-solid fa-circle-info mt-0.5 shrink-0 text-zinc-400" aria-hidden />
            <span>
              이메일은 아이디·비밀번호 찾기에 사용됩니다.{" "}
              <b className="font-semibold">입력하지 않으면 계정 복구가 불가능</b>하니 정확히
              입력해주세요.
            </span>
          </p>

          <label className="flex items-start gap-2 px-1 text-sm text-zinc-600">
            <input type="checkbox" name="agree" className="mt-0.5" />
            <span>
              <Link href="/terms" target="_blank" className="text-emerald-600 underline">
                이용약관
              </Link>{" "}
              및{" "}
              <Link href="/privacy" target="_blank" className="text-emerald-600 underline">
                개인정보처리방침
              </Link>
              에 동의합니다.
            </span>
          </label>

          <button className="w-full rounded-xl bg-emerald-600 py-3 font-semibold text-white transition hover:bg-emerald-500">
            가입하기
          </button>
        </form>
        <p className="mt-5 text-center text-sm text-zinc-500">
          이미 계정이 있으신가요?{" "}
          <Link href="/login" className="font-medium text-emerald-600">
            로그인
          </Link>
        </p>
      </div>
    </main>
  );
}
