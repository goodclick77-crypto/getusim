import Link from "next/link";
import { requireUser } from "@/lib/session";
import { ymd, pt } from "@/lib/format";
import { updateProfile, withdrawAccount } from "./actions";
import ConfirmButton from "@/components/ConfirmButton";
import Reveal from "@/components/Reveal";

const WITHDRAW_ERRORS: Record<string, string> = {
  pw: "비밀번호가 일치하지 않습니다.",
  agree: "잔여 포인트 소멸에 동의해야 탈퇴할 수 있습니다.",
  active: "진행 중인 번호가 있어 탈퇴할 수 없습니다. 번호 만료·완료 후 다시 시도해주세요.",
};

export const dynamic = "force-dynamic";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="flex items-center gap-2 text-xl font-bold">
        <i className="fa-solid fa-user text-emerald-600" aria-hidden /> 내 정보
      </h1>

      {sp.ok && (
        <p role="status" className="glass flex items-center gap-2 rounded-2xl px-4 py-3 text-sm text-emerald-700">
          <i className="fa-solid fa-circle-check" aria-hidden /> 저장되었습니다.
        </p>
      )}
      {sp.error === "email" && (
        <p role="alert" className="glass flex items-center gap-2 rounded-2xl px-4 py-3 text-sm text-red-600">
          <i className="fa-solid fa-circle-exclamation" aria-hidden /> 올바른 이메일 형식을 입력하세요.
        </p>
      )}
      {sp.error && WITHDRAW_ERRORS[sp.error] && (
        <p role="alert" className="glass flex items-center gap-2 rounded-2xl px-4 py-3 text-sm text-red-600">
          <i className="fa-solid fa-circle-exclamation" aria-hidden /> {WITHDRAW_ERRORS[sp.error]}
        </p>
      )}

      {/* 기본 정보 */}
      <Reveal>
        <section className="glass rounded-2xl p-5">
          <dl className="divide-y divide-black/5 text-sm">
            <Row label="아이디" value={user.loginId} />
            <Row label="가입일" value={ymd(user.createdAt)} />
            <Row label="등급" value={user.role === "ADMIN" ? "관리자" : "일반회원"} />
          </dl>
          <p className="mt-3 text-xs text-zinc-400">아이디는 변경할 수 없습니다.</p>
        </section>
      </Reveal>

      {/* 수정 가능한 정보 */}
      <Reveal delay={80}>
        <section className="glass rounded-2xl p-5">
          <h2 className="mb-1 font-bold">연락처 정보 수정</h2>
          <p className="mb-4 text-xs text-zinc-500">
            이메일은 <b>아이디·비밀번호 찾기</b>에 사용됩니다. 받을 수 있는 주소로 정확히 입력하세요.
          </p>
          <form action={updateProfile} className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs text-zinc-500">이메일</span>
              <input
                name="email"
                type="email"
                defaultValue={user.email}
                placeholder="이메일"
                aria-label="이메일"
                className="w-full rounded-xl border border-black/10 bg-white/60 px-3.5 py-3 outline-none focus:border-emerald-500"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-zinc-500">이름</span>
              <input
                name="name"
                defaultValue={user.name}
                placeholder="이름"
                aria-label="이름"
                className="w-full rounded-xl border border-black/10 bg-white/60 px-3.5 py-3 outline-none focus:border-emerald-500"
              />
            </label>
            <button className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white transition hover:bg-emerald-500">
              <i className="fa-solid fa-floppy-disk" aria-hidden /> 저장
            </button>
          </form>
        </section>
      </Reveal>

      {/* 회원 탈퇴 (관리자 제외) */}
      {user.role !== "ADMIN" && (
        <Reveal delay={160}>
          <section className="glass rounded-2xl border border-red-200/70 p-5">
            <h2 className="mb-1 flex items-center gap-2 font-bold text-red-600">
              <i className="fa-solid fa-user-slash" aria-hidden /> 회원 탈퇴
            </h2>
            <p className="mb-3 text-xs text-zinc-500">
              탈퇴하면 계정이 즉시 비활성화되어 같은 아이디로 다시 로그인할 수 없습니다.
            </p>

            {user.point > 0 && (
              <details className="mb-3 rounded-xl border border-black/10 bg-black/[0.015] px-3 py-2">
                <summary className="cursor-pointer select-none text-xs text-zinc-500">
                  탈퇴 시 잔여 포인트 처리 안내
                </summary>
                <div className="mt-2 space-y-1 text-xs text-zinc-500">
                  <p>보유 포인트 {pt(user.point)}는 탈퇴 시 소멸되며 복구되지 않습니다.</p>
                  <p>
                    환불을 원하시면 탈퇴 전{" "}
                    <Link href="/inquiry" className="font-medium text-emerald-700 underline">
                      1:1 문의(환불문의)
                    </Link>
                    로 신청하세요.
                  </p>
                </div>
              </details>
            )}

            <form action={withdrawAccount} className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs text-zinc-500">비밀번호 확인</span>
                <input
                  name="password"
                  type="password"
                  required
                  placeholder="현재 비밀번호"
                  aria-label="현재 비밀번호"
                  className="w-full rounded-xl border border-black/10 bg-white/60 px-3.5 py-3 outline-none focus:border-red-400"
                />
              </label>

              {user.point > 0 && (
                <label className="flex items-start gap-2 text-xs text-zinc-600">
                  <input type="checkbox" name="agreePointLoss" required className="mt-0.5" />
                  <span>보유 포인트 {pt(user.point)}가 소멸되는 것에 동의합니다.</span>
                </label>
              )}

              <ConfirmButton
                message={`정말 탈퇴하시겠어요?${user.point > 0 ? ` 보유 포인트 ${pt(user.point)}가 소멸되며,` : ""} 같은 아이디로 다시 로그인할 수 없습니다.`}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 font-semibold text-white transition hover:bg-red-500"
              >
                <i className="fa-solid fa-user-slash" aria-hidden /> 회원 탈퇴
              </ConfirmButton>
            </form>
          </section>
        </Reveal>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-2.5">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="col-span-2 font-medium">{value || "-"}</dd>
    </div>
  );
}
