import Link from "next/link";
import { loginAction } from "./actions";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  empty: "아이디와 비밀번호를 입력하세요.",
  invalid: "아이디 또는 비밀번호가 올바르지 않습니다.",
};

export default async function LoginPage({
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
        <h1 className="mt-8 text-lg font-semibold">로그인</h1>
        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {ERRORS[error] ?? "로그인에 실패했습니다."}
          </p>
        )}
        <form action={loginAction} className="mt-4 space-y-3">
          <input
            name="loginId"
            placeholder="아이디"
            autoComplete="username"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2.5"
          />
          <input
            name="password"
            type="password"
            placeholder="비밀번호"
            autoComplete="current-password"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2.5"
          />
          <button className="w-full rounded-lg bg-emerald-600 py-2.5 font-medium text-white hover:bg-emerald-500">
            로그인
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-zinc-500">
          계정이 없으신가요?{" "}
          <Link href="/register" className="text-emerald-600">
            회원가입
          </Link>
        </p>
      </div>
    </div>
  );
}
