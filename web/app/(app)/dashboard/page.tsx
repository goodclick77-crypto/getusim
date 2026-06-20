import Link from "next/link";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { pt, ymdhm } from "@/lib/format";
import Reveal from "@/components/Reveal";
import Tilt from "@/components/Tilt";
import RentalLabel from "@/components/RentalLabel";

export const dynamic = "force-dynamic";

const RENTAL_STATUS: Record<string, string> = {
  PENDING: "수신대기",
  RECEIVED: "수신완료",
  FINISHED: "완료",
  CANCELED: "취소",
  EXPIRED: "만료",
};

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
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {/* 보유 포인트 (벤토 대형 박스) */}
      <Reveal className="sm:col-span-3">
        <Tilt max={5} className="h-full">
          <section className="glass-dark flex h-full flex-col justify-between rounded-3xl p-6 text-white sm:flex-row sm:items-center">
            <div>
              <p className="flex items-center gap-2 text-sm text-zinc-400">
                <i className="fa-solid fa-wallet text-emerald-400" aria-hidden /> 보유 포인트
              </p>
              <p className="mt-2 font-num text-4xl font-bold">{pt(user.point)}</p>
            </div>
            <div className="mt-6 flex flex-wrap gap-2 sm:mt-0">
              <Link
                href="/sms"
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-400"
              >
                <i className="fa-solid fa-comment-sms" aria-hidden /> SMS 인증받기
              </Link>
              <Link
                href="/charge"
                className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20"
              >
                <i className="fa-solid fa-coins" aria-hidden /> 포인트 충전
              </Link>
            </div>
          </section>
        </Tilt>
      </Reveal>

      {/* 최근 인증 내역 */}
      <Reveal delay={120} className="sm:col-span-1">
        <section className="glass h-full rounded-3xl p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-bold">
              <i className="fa-solid fa-clock-rotate-left text-emerald-600" aria-hidden /> 최근 인증
            </h2>
            <Link href="/history?tab=rental" className="text-sm text-emerald-600 hover:underline">
              전체보기
            </Link>
          </div>
          {rentals.length === 0 ? (
            <p className="text-sm text-zinc-500">아직 이용 내역이 없습니다.</p>
          ) : (
            <ul className="space-y-2">
              {rentals.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 rounded-xl bg-black/[0.03] px-3 py-2 text-sm">
                  <RentalLabel country={r.country} service={r.service} />
                  <span className="ml-2 shrink-0 text-xs text-zinc-500">
                    {RENTAL_STATUS[r.status]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </Reveal>

      {/* 포인트 내역 */}
      <Reveal delay={160} className="sm:col-span-2">
        <section className="glass h-full rounded-3xl p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-bold">
              <i className="fa-solid fa-receipt text-emerald-600" aria-hidden /> 포인트 내역
            </h2>
            <Link href="/history" className="text-sm text-emerald-600 hover:underline">
              전체보기
            </Link>
          </div>
          {points.length === 0 ? (
            <p className="text-sm text-zinc-500">내역이 없습니다.</p>
          ) : (
            <ul className="divide-y divide-black/5">
              {points.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <p>{p.reason || "포인트 변동"}</p>
                    <p className="font-num text-xs text-zinc-400">{ymdhm(p.createdAt)}</p>
                  </div>
                  <span
                    className={`font-num font-semibold ${p.amount >= 0 ? "text-emerald-600" : "text-red-500"}`}
                  >
                    {p.amount >= 0 ? "+" : ""}
                    {pt(p.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </Reveal>
    </div>
  );
}
