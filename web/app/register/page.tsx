import Link from "next/link";
import { registerAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <Link href="/" className="block text-center text-2xl font-bold">
          GetUsim
        </Link>
        <h1 className="mt-8 text-lg font-semibold">회원가입</h1>
        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}
        <form action={registerAction} className="mt-4 space-y-3">
          <input name="loginId" placeholder="아이디 (영문/숫자 3~20자)" className="w-full rounded-lg border border-zinc-300 px-3 py-2.5" />
          <input name="password" type="password" placeholder="비밀번호 (6자 이상)" className="w-full rounded-lg border border-zinc-300 px-3 py-2.5" />
          <input name="name" placeholder="이름" className="w-full rounded-lg border border-zinc-300 px-3 py-2.5" />
          <input name="email" type="email" placeholder="이메일" className="w-full rounded-lg border border-zinc-300 px-3 py-2.5" />
          <input name="phone" placeholder="휴대폰 번호" className="w-full rounded-lg border border-zinc-300 px-3 py-2.5" />
          <button className="w-full rounded-lg bg-emerald-600 py-2.5 font-medium text-white hover:bg-emerald-500">
            가입하기
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-zinc-500">
          이미 계정이 있으신가요?{" "}
          <Link href="/login" className="text-emerald-600">
            로그인
          </Link>
        </p>
      </div>
    </div>
  );
}
