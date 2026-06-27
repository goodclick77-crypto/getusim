import { requireUser } from "@/lib/session";
import { ymd } from "@/lib/format";
import { updateProfile } from "./actions";
import Reveal from "@/components/Reveal";

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
            <label className="block">
              <span className="mb-1 block text-xs text-zinc-500">휴대폰 (선택)</span>
              <input
                name="phone"
                defaultValue={user.phone}
                placeholder="숫자만 입력"
                inputMode="numeric"
                aria-label="휴대폰"
                className="w-full rounded-xl border border-black/10 bg-white/60 px-3.5 py-3 outline-none focus:border-emerald-500"
              />
            </label>
            <button className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white transition hover:bg-emerald-500">
              <i className="fa-solid fa-floppy-disk" aria-hidden /> 저장
            </button>
          </form>
        </section>
      </Reveal>
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
