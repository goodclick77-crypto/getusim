import Link from "next/link";

export const dynamic = "force-dynamic";

const FIELDS = [
  { name: "loginId", placeholder: "아이디 (영문/숫자 3~20자)", type: "text", icon: "fa-user" },
  { name: "password", placeholder: "비밀번호 (6자 이상)", type: "password", icon: "fa-lock" },
  { name: "name", placeholder: "이름", type: "text", icon: "fa-id-card" },
  { name: "email", placeholder: "이메일", type: "email", icon: "fa-envelope" },
  { name: "phone", placeholder: "휴대폰 번호", type: "text", icon: "fa-mobile-screen" },
];

export default async function RegisterPage({
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
          <i className="fa-solid fa-user-plus text-emerald-600" aria-hidden /> 회원가입
        </h1>
        {error && (
          <p
            role="alert"
            className="mt-3 flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600"
          >
            <i className="fa-solid fa-circle-exclamation" aria-hidden />
            {error}
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
                className="w-full bg-transparent outline-none"
              />
            </label>
          ))}
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
