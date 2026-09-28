import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { mailHealth } from "@/lib/notify";
import { ymdhm } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/dashboard");
  const mail = mailHealth();

  return (
    <div className="flex flex-1 flex-col">
      <header className="glass-dark sticky top-0 z-40 text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/admin" className="flex items-center gap-2 font-mont text-lg font-extrabold">
            <i className="fa-solid fa-gauge-high text-emerald-400" aria-hidden /> GetUsim 관리자
          </Link>
          <nav aria-label="관리자 메뉴" className="flex items-center gap-1 text-sm">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 rounded-xl px-3 py-1.5 text-zinc-300 hover:bg-white/10 hover:text-white"
            >
              <i className="fa-solid fa-user" aria-hidden /> 사용자 화면
            </Link>
            <form action="/logout" method="POST">
              <button
                type="submit"
                className="flex items-center gap-2 rounded-xl px-3 py-1.5 text-zinc-300 hover:bg-white/10 hover:text-white"
              >
                <i className="fa-solid fa-right-from-bracket" aria-hidden /> 로그아웃
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {/* 메일이 안 되는 상황은 메일로 알릴 수 없어서 관리자 화면 전체에 띄운다 */}
        {!mail.configured ? (
          <div role="alert" className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <p className="flex items-center gap-2 font-bold">
              <i className="fa-solid fa-triangle-exclamation" aria-hidden /> 이메일 발송 설정이 없습니다
            </p>
            <p className="mt-1">
              지금은 <b>이메일 인증 없이 누구나 가입</b>되고, 관리자 2단계 인증·모든 알림 메일·아이디/비밀번호 찾기가
              꺼져 있습니다. Railway 환경변수에 <code>RESEND_API_KEY</code> 또는 <code>GMAIL_USER</code>·
              <code>GMAIL_APP_PASSWORD</code>를 넣어주세요.
            </p>
          </div>
        ) : mail.failing ? (
          <div role="alert" className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <p className="flex items-center gap-2 font-bold">
              <i className="fa-solid fa-triangle-exclamation" aria-hidden /> 이메일 발송이 실패하고 있습니다 (
              {ymdhm(mail.failing.at)})
            </p>
            <p className="mt-1">
              인증번호 메일이 가지 않아 <b>신규 가입이 막힐 수 있습니다</b>. 알림 설정에서 테스트 발송으로 확인하세요.
            </p>
            <p className="mt-1 break-all text-xs text-amber-700">오류: {mail.failing.message}</p>
          </div>
        ) : null}
        {children}
      </main>
    </div>
  );
}
