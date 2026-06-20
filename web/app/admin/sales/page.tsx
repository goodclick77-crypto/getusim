import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { won, pt } from "@/lib/format";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "today", label: "오늘" },
  { key: "7d", label: "7일" },
  { key: "30d", label: "30일" },
  { key: "all", label: "전체" },
] as const;

function sinceOf(period: string): Date {
  const now = new Date();
  if (period === "today") return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === "7d") return new Date(now.getTime() - 7 * 86400000);
  if (period === "all") return new Date(0);
  return new Date(now.getTime() - 30 * 86400000);
}

export default async function AdminSalesPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const period = ["today", "7d", "30d", "all"].includes(sp.period || "")
    ? (sp.period as string)
    : "30d";
  const since = sinceOf(period);

  const [chargeAgg, rentalAgg, byUser, attemptCount, failCount] = await Promise.all([
    prisma.chargeOrder.aggregate({
      _sum: { amount: true },
      _count: true,
      where: { status: "COMPLETED", createdAt: { gte: since } },
    }),
    prisma.numberRental.aggregate({
      _sum: { pricePoint: true, costKrw: true },
      _count: true,
      where: { status: "RECEIVED", createdAt: { gte: since } },
    }),
    prisma.numberRental.groupBy({
      by: ["userId"],
      where: { status: "RECEIVED", createdAt: { gte: since } },
      _sum: { pricePoint: true, costKrw: true },
      _count: true,
      orderBy: { _sum: { pricePoint: "desc" } },
      take: 30,
    }),
    // 발급 시도(전체) / 실패(취소·밴) 건수
    prisma.numberRental.count({ where: { createdAt: { gte: since } } }),
    prisma.numberRental.count({ where: { status: "CANCELED", createdAt: { gte: since } } }),
  ]);

  const userIds = byUser.map((b) => b.userId);
  const [users, chargesByUser, failByUser] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, loginId: true, name: true },
    }),
    prisma.chargeOrder.groupBy({
      by: ["userId"],
      where: { status: "COMPLETED", userId: { in: userIds }, createdAt: { gte: since } },
      _sum: { amount: true },
    }),
    prisma.numberRental.groupBy({
      by: ["userId"],
      where: { status: "CANCELED", userId: { in: userIds }, createdAt: { gte: since } },
      _count: true,
    }),
  ]);
  const userMap = new Map(users.map((u) => [u.id, u]));
  const chargeMap = new Map(chargesByUser.map((c) => [c.userId, c._sum.amount ?? 0]));
  const failMap = new Map(failByUser.map((f) => [f.userId, f._count]));

  const chargeRevenue = chargeAgg._sum.amount ?? 0;
  const smsSales = rentalAgg._sum.pricePoint ?? 0;
  const cost = rentalAgg._sum.costKrw ?? 0;
  const netMargin = chargeRevenue - cost;
  const success = rentalAgg._count;
  const successRate = success + failCount > 0 ? Math.round((success / (success + failCount)) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <i className="fa-solid fa-chart-line text-emerald-600" aria-hidden /> 매출 / 정산
        </h1>
        <Link href="/admin" className="text-sm text-zinc-500 hover:text-zinc-900">
          ← 관리자 홈
        </Link>
      </div>

      <nav aria-label="기간" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/sales?period=${t.key}`}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              period === t.key ? "bg-zinc-900 text-white" : "glass text-zinc-600 hover:bg-white/70"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card icon="fa-credit-card" label="충전 매출" value={won(chargeRevenue)} sub={`${chargeAgg._count}건`} />
        <Card icon="fa-globe" label="5sim 원가(지출)" value={won(cost)} sub={`${success}건 수신성공`} tone="cost" />
        <Card icon="fa-sack-dollar" label="순마진 (충전−원가)" value={won(netMargin)} highlight />
        <Card icon="fa-comment-sms" label="SMS 차감" value={pt(smsSales)} sub="사용 포인트" />
      </section>

      {/* 발급 현황 (성공/실패/성공률) */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card icon="fa-mobile-screen-button" label="발급 시도" value={`${attemptCount.toLocaleString("ko-KR")}건`} />
        <Card icon="fa-circle-check" label="수신 성공" value={`${success.toLocaleString("ko-KR")}건`} />
        <Card icon="fa-circle-xmark" label="실패(취소·밴)" value={`${failCount.toLocaleString("ko-KR")}건`} tone="cost" />
        <Card icon="fa-percent" label="성공률" value={`${successRate}%`} highlight />
      </section>

      <section>
        <h2 className="mb-3 font-bold">사용자별 (SMS 사용 순)</h2>
        {byUser.length === 0 ? (
          <p className="text-sm text-zinc-500">해당 기간 사용 내역이 없습니다.</p>
        ) : (
          <div className="glass overflow-hidden rounded-2xl">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-black/5 text-xs text-zinc-500">
                    <th className="px-4 py-2.5 text-left font-semibold">아이디</th>
                    <th className="px-4 py-2.5 text-center font-semibold">성공</th>
                    <th className="px-4 py-2.5 text-center font-semibold">실패</th>
                    <th className="px-4 py-2.5 text-right font-semibold">충전액</th>
                    <th className="px-4 py-2.5 text-right font-semibold">SMS사용P</th>
                    <th className="px-4 py-2.5 text-right font-semibold">원가</th>
                    <th className="px-4 py-2.5 text-right font-semibold">마진</th>
                  </tr>
                </thead>
                <tbody>
                  {byUser.map((b) => {
                    const u = userMap.get(b.userId);
                    const usedP = b._sum.pricePoint ?? 0;
                    const c = b._sum.costKrw ?? 0;
                    const margin = usedP - c;
                    return (
                      <tr key={b.userId} className="border-b border-black/5 last:border-0 hover:bg-black/[0.02]">
                        <td className="px-4 py-2.5">
                          <Link href={`/admin/members/${b.userId}`} className="font-num font-medium text-emerald-700 hover:underline">
                            {u?.loginId ?? b.userId}
                          </Link>
                        </td>
                        <td className="font-num px-4 py-2.5 text-center text-emerald-600">{b._count}</td>
                        <td className="font-num px-4 py-2.5 text-center text-zinc-400">{failMap.get(b.userId) ?? 0}</td>
                        <td className="font-num px-4 py-2.5 text-right">{won(chargeMap.get(b.userId) ?? 0)}</td>
                        <td className="font-num px-4 py-2.5 text-right">{pt(usedP)}</td>
                        <td className="font-num px-4 py-2.5 text-right text-zinc-500">{won(c)}</td>
                        <td className={`font-num px-4 py-2.5 text-right font-semibold ${margin >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                          {won(margin)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <p className="text-xs text-zinc-400">
        ※ 5sim 원가는 원가 저장 기능 추가 이후 발급분만 집계됩니다(이전 발급분은 0). 순마진 = 충전
        매출 − 5sim 원가.
      </p>
    </div>
  );
}

function Card({
  icon,
  label,
  value,
  sub,
  highlight,
  tone,
}: {
  icon: string;
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
  tone?: "cost";
}) {
  return (
    <div
      className={`rounded-2xl p-4 ${highlight ? "glass-dark text-white" : "glass"}`}
    >
      <p className={`flex items-center gap-2 text-xs ${highlight ? "text-zinc-300" : "text-zinc-500"}`}>
        <i className={`fa-solid ${icon} ${highlight ? "text-emerald-400" : tone === "cost" ? "text-red-500" : "text-emerald-600"}`} aria-hidden />
        {label}
      </p>
      <p className="font-num mt-1 text-lg font-bold">{value}</p>
      {sub && <p className={`text-xs ${highlight ? "text-zinc-400" : "text-zinc-400"}`}>{sub}</p>}
    </div>
  );
}
