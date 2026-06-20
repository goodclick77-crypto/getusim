import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { saveNotifyConfig, testEmail } from "./actions";

export const dynamic = "force-dynamic";

const EVENTS = [
  { key: "onDeposit", label: "충전 입금 감지", desc: "은행 입금이 자동확인/미매칭될 때" },
  { key: "onChargeRequest", label: "충전 신청", desc: "회원이 충전을 신청(입금 전)할 때" },
  { key: "onOrder", label: "번호 주문", desc: "회원이 SMS 인증 번호를 발급받을 때" },
  { key: "onInquiry", label: "1:1 문의 등록", desc: "새 문의가 등록될 때" },
] as const;

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; test?: string; msg?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;

  const cfg = await prisma.notifyConfig.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {},
  });

  const envReady = !!process.env.GMAIL_USER && !!process.env.GMAIL_APP_PASSWORD;
  const to = process.env.ADMIN_EMAIL || process.env.GMAIL_USER || "(미설정)";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <i className="fa-solid fa-bell text-emerald-600" aria-hidden /> 알림 설정
        </h1>
        <Link href="/admin" className="text-sm text-zinc-500 hover:text-zinc-900">
          ← 관리자 홈
        </Link>
      </div>

      {sp.ok && (
        <p className="glass rounded-xl px-4 py-3 text-sm text-emerald-700">설정을 저장했습니다.</p>
      )}
      {sp.test === "ok" && (
        <p className="glass rounded-xl px-4 py-3 text-sm text-emerald-700">
          테스트 메일을 보냈습니다. <b>{to}</b> 수신함을 확인하세요.
        </p>
      )}
      {sp.test === "fail" && (
        <p className="glass rounded-xl px-4 py-3 text-sm text-red-600">
          발송 실패: {sp.msg || "환경변수를 확인하세요."}
        </p>
      )}

      {/* 이메일 연결 상태 */}
      <section className="glass rounded-2xl p-5">
        <h2 className="flex items-center gap-2 font-bold">
          <i className="fa-solid fa-envelope text-zinc-500" aria-hidden /> Gmail 연결
        </h2>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <span
            className={`rounded-md px-2 py-0.5 text-xs font-medium ${
              envReady ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
            }`}
          >
            {envReady ? "연결됨" : "환경변수 미설정"}
          </span>
          <span className="text-zinc-500">받는 주소: {to}</span>
        </div>
        {!envReady && (
          <p className="mt-2 text-xs text-zinc-500">
            Railway getusim 카드 Variables에 <code>GMAIL_USER</code>, <code>GMAIL_APP_PASSWORD</code>,{" "}
            <code>ADMIN_EMAIL</code>(받는 주소)을 설정하세요.
          </p>
        )}
        <form action={testEmail} className="mt-3">
          <button className="rounded-xl border border-black/10 px-4 py-2 text-sm font-medium hover:bg-black/5">
            <i className="fa-solid fa-paper-plane mr-1.5" aria-hidden /> 테스트 메일 보내기
          </button>
        </form>
      </section>

      {/* 알림 받을 이벤트 */}
      <form action={saveNotifyConfig}>
        <section className="glass rounded-2xl p-5">
          <h2 className="mb-1 font-bold">알림 받을 상황</h2>
          <p className="mb-4 text-xs text-zinc-500">체크한 상황만 관리자 이메일로 알림이 갑니다.</p>
          <ul className="space-y-2">
            {EVENTS.map((e) => (
              <li key={e.key}>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-black/10 bg-white/50 p-3 transition has-checked:border-emerald-500 has-checked:bg-emerald-50">
                  <input
                    type="checkbox"
                    name={e.key}
                    defaultChecked={!!cfg?.[e.key]}
                    className="mt-0.5 h-4 w-4 accent-emerald-600"
                  />
                  <span>
                    <span className="block text-sm font-medium">{e.label}</span>
                    <span className="block text-xs text-zinc-500">{e.desc}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <button className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500">
            <i className="fa-solid fa-floppy-disk" aria-hidden /> 저장
          </button>
        </section>
      </form>
    </div>
  );
}
