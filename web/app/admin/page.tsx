import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { won, pt } from "@/lib/format";
import Tilt from "@/components/Tilt";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdmin();
  const [userCount, pointSum, pendingCharges, openInquiries, todayCharge] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.aggregate({ _sum: { point: true } }),
      prisma.chargeOrder.count({ where: { status: "PENDING" } }),
      prisma.inquiry.count({ where: { parentId: null, status: "OPEN" } }),
      prisma.chargeOrder.aggregate({
        _sum: { amount: true },
        where: { status: "COMPLETED" },
      }),
    ]);

  const MENU = [
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
  ];

  return (
    <div className="space-y-8">
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
