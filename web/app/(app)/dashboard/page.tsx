import Link from "next/link";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { pt, ymdhm } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const [points, rentals] = await Promise.all([
    prisma.pointLog.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.numberRental.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  return (
    <div className="space-y-8">
      <section className="rounded-2xl bg-zinc-900 p-6 text-white">
        <p className="text-sm text-zinc-400">보유 포인트</p>
        <p className="mt-1 text-3xl font-bold">{pt(user.point)}</p>
        <div className="mt-4 flex gap-2">
          <Link href="/sms" className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium hover:bg-emerald-400">
            SMS 인증받기
          </Link>
          <Link href="/charge" className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/20">
            포인트 충전
          </Link>
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-semibold">최근 인증 내역</h2>
        {rentals.length === 0 ? (
          <p className="text-sm text-zinc-500">아직 이용 내역이 없습니다.</p>
        ) : (
          <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white">
            {rentals.map((r) => (
              <li key={r.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span>
                  {r.service} · {r.country} · {r.phoneNumber || "발급중"}
                </span>
                <span className="text-zinc-500">{r.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-semibold">포인트 내역</h2>
        {points.length === 0 ? (
          <p className="text-sm text-zinc-500">내역이 없습니다.</p>
        ) : (
          <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white">
            {points.map((p) => (
              <li key={p.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <p>{p.reason || "포인트 변동"}</p>
                  <p className="text-xs text-zinc-400">{ymdhm(p.createdAt)}</p>
                </div>
                <span className={p.amount >= 0 ? "text-emerald-600" : "text-red-500"}>
                  {p.amount >= 0 ? "+" : ""}
                  {pt(p.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
