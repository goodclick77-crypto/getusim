import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { won, pt } from "@/lib/format";
import { fivesim } from "@/lib/fivesim";
import Tilt from "@/components/Tilt";
import ConfirmButton from "@/components/ConfirmButton";
import { runSweep } from "./actions";

export const dynamic = "force-dynamic";

// 5sim 잔액이 이 값 미만이면 경고(번호 발급이 곧 중단될 수 있음)
const FIVESIM_LOW_BALANCE = 10;

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ swept?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const [userCount, pointSum, pendingCharges, openInquiries, todayCharge, fivesimBalance] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.aggregate({ _sum: { point: true } }),
      prisma.chargeOrder.count({ where: { status: "PENDING" } }),
      prisma.inquiry.count({ where: { parentId: null, status: "OPEN" } }),
      prisma.chargeOrder.aggregate({
        _sum: { amount: true },
        where: { status: "COMPLETED" },
      }),
      // 5sim 잔액 조회(실패해도 홈은 정상 표시)
      fivesim.profile().then((p) => p.balance).catch(() => null),
    ]);
  const lowBalance = fivesimBalance !== null && fivesimBalance < FIVESIM_LOW_BALANCE;

  const MENU = [
    {
      href: "/admin/sales",
      icon: "fa-chart-line",
      label: "매출 / 정산",
      desc: "충전매출·원가·마진·사용자별",
      badge: 0,
    },
    {
      href: "/admin/members",
      icon: "fa-users",
      label: "회원 관리",
      desc: "회원 조회·포인트 지급/차감",
      badge: 0,
    },
    {
      href: "/admin/logins",
      icon: "fa-right-to-bracket",
      label: "로그인 현황",
      desc: "최근 접속자·마지막 로그인 기록",
      badge: 0,
    },
    {
      href: "/admin/rentals",
      icon: "fa-mobile-screen-button",
      label: "발급 내역",
      desc: "번호 발급 성공·실패 상세 로그",
      badge: 0,
    },
    {
      href: "/admin/charges",
      icon: "fa-building-columns",
      label: "입금 확인",
      desc: "충전 신청 입금확인·지급",
      badge: pendingCharges,
    },
    {
      href: "/admin/inquiries",
      icon: "fa-comments",
      label: "문의 관리",
      desc: "1:1 문의 답변",
      badge: openInquiries,
    },
    {
      href: "/admin/notice",
      icon: "fa-bullhorn",
      label: "공지 관리",
      desc: "공지사항 작성·고정",
      badge: 0,
    },
    {
      href: "/admin/faq",
      icon: "fa-circle-question",
      label: "FAQ 관리",
      desc: "자주 묻는 질문 관리",
      badge: 0,
    },
    {
      href: "/admin/settings",
      icon: "fa-bell",
      label: "알림 설정",
      desc: "이메일 알림 받을 상황 설정",
      badge: 0,
    },
  ];

  return (
    <div className="space-y-8">
      {sp.swept !== undefined && (
        <p
          role="alert"
          aria-live="polite"
          className="glass flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          <i className="fa-solid fa-circle-check mt-0.5 text-emerald-600" aria-hidden />
          <span>
            <b>정리 완료.</b> 버려진 발급번호를 5sim에서 취소했고, 오래된 미입금 충전신청{" "}
            {sp.swept}건을 취소했습니다.
          </span>
        </p>
      )}

      {/* 방치된 건 정리 — 크론 미설정 시 여기서 수동 실행 */}
      <form action={runSweep} className="glass flex items-center gap-3 rounded-2xl px-4 py-3">
        <i className="fa-solid fa-broom text-emerald-600" aria-hidden />
        <span className="min-w-0 flex-1 text-sm text-zinc-600">
          <b className="text-zinc-800">방치된 건 정리</b>
          <br />
          <span className="text-xs text-zinc-500">
            대기 중 창을 닫아 버려진 발급번호를 5sim에서 취소(원가 환불)하고, 14일 지난 미입금
            충전신청을 정리합니다.
          </span>
        </span>
        <ConfirmButton
          message="방치된 건을 정리할까요? 버려진 번호는 5sim에서 취소되고, 14일 지난 미입금 충전신청은 취소됩니다."
          className="shrink-0 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500"
        >
          지금 정리
        </ConfirmButton>
      </form>

      {/* 5sim 잔액 상태 — 낮으면 경고 */}
      {fivesimBalance === null ? (
        <div className="glass flex items-center gap-2 rounded-2xl px-4 py-3 text-sm text-zinc-500">
          <i className="fa-solid fa-globe text-zinc-400" aria-hidden />
          5sim 잔액을 확인하지 못했습니다.
        </div>
      ) : lowBalance ? (
        <div className="flex items-start gap-3 rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          <i className="fa-solid fa-triangle-exclamation mt-0.5" aria-hidden />
          <span>
            <b>5sim 잔액 부족 — 현재 {fivesimBalance.toLocaleString("ko-KR")}</b>
            <br />
            잔액이 {FIVESIM_LOW_BALANCE} 미만입니다. 충전하지 않으면 번호 발급이 중단될 수 있습니다.
          </span>
        </div>
      ) : (
        <div className="glass flex items-center gap-2 rounded-2xl px-4 py-3 text-sm text-zinc-600">
          <i className="fa-solid fa-globe text-emerald-600" aria-hidden />
          5sim 잔액 <b className="font-num">{fivesimBalance.toLocaleString("ko-KR")}</b>
        </div>
      )}

      <section aria-label="통계" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon="fa-users" label="총 회원" value={userCount.toLocaleString("ko-KR")} />
        <Stat icon="fa-coins" label="발행 포인트" value={pt(pointSum._sum.point ?? 0)} />
        <Stat icon="fa-hourglass-half" label="입금 대기" value={`${pendingCharges}건`} alert={pendingCharges > 0} />
        <Stat icon="fa-comment-dots" label="미답변 문의" value={`${openInquiries}건`} alert={openInquiries > 0} />
      </section>

      <section>
        <h2 className="mb-3 font-bold">관리 메뉴</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {MENU.map((m) => (
            <Tilt key={m.href}>
              <Link
                href={m.href}
                className="glass flex items-center gap-4 rounded-2xl p-5 transition hover:bg-white/70"
              >
                <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-600/10 text-xl text-emerald-600">
                  <i className={`fa-solid ${m.icon}`} aria-hidden />
                  {m.badge > 0 && (
                    <span className="font-num absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
                      {m.badge}
                    </span>
                  )}
                </span>
                <span>
                  <span className="block font-bold">{m.label}</span>
                  <span className="block text-sm text-zinc-500">{m.desc}</span>
                </span>
                <i className="fa-solid fa-chevron-right ml-auto text-zinc-300" aria-hidden />
              </Link>
            </Tilt>
          ))}
        </div>
      </section>

      <p className="font-num text-sm text-zinc-400">
        누적 충전 매출 {won(todayCharge._sum.amount ?? 0)}
      </p>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  alert,
}: {
  icon: string;
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <div className={`glass rounded-2xl p-4 ${alert ? "ring-2 ring-red-400/40" : ""}`}>
      <p className="flex items-center gap-2 text-xs text-zinc-500">
        <i className={`fa-solid ${icon} text-emerald-600`} aria-hidden /> {label}
      </p>
      <p className="font-num mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}
