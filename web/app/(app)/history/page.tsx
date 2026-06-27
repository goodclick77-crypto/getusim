import Link from "next/link";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { pt, ymdhm, phoneFmt } from "@/lib/format";
import RentalLabel from "@/components/RentalLabel";
import CopyButton from "@/components/CopyButton";

export const dynamic = "force-dynamic";

const PER = 30;
const RENTAL_STATUS: Record<string, string> = {
  PENDING: "수신대기",
  RECEIVED: "수신완료",
  FINISHED: "완료",
  CANCELED: "취소",
  EXPIRED: "만료",
};

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const tab = sp.tab === "rental" ? "rental" : "point";
  const page = Math.max(1, Number(sp.page) || 1);
  const skip = (page - 1) * PER;

  const [points, pointTotal, rentals, rentalTotal] = await Promise.all([
    tab === "point"
      ? prisma.pointLog.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, skip, take: PER })
      : Promise.resolve([]),
    prisma.pointLog.count({ where: { userId: user.id } }),
    tab === "rental"
      ? prisma.numberRental.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, skip, take: PER })
      : Promise.resolve([]),
    prisma.numberRental.count({ where: { userId: user.id } }),
  ]);

  const total = tab === "point" ? pointTotal : rentalTotal;
  const lastPage = Math.max(1, Math.ceil(total / PER));

  return (
    <div className="space-y-5">
      <h1 className="flex items-center gap-2 text-xl font-bold">
        <i className="fa-solid fa-clock-rotate-left text-emerald-600" aria-hidden /> 이용 내역
      </h1>

      <nav className="flex gap-2">
        <Tab href="/history?tab=point" active={tab === "point"} label={`포인트 내역 (${pointTotal})`} />
        <Tab href="/history?tab=rental" active={tab === "rental"} label={`인증 내역 (${rentalTotal})`} />
      </nav>

      {total === 0 ? (
        <p className="text-sm text-zinc-500">내역이 없습니다.</p>
      ) : tab === "point" ? (
        <ul className="glass divide-y divide-black/5 rounded-2xl">
          {points.map((p) => (
            <li key={p.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <p>{p.reason || "포인트 변동"}</p>
                <p className="font-num text-xs text-zinc-400">{ymdhm(p.createdAt)}</p>
              </div>
              <span className={`font-num font-semibold ${p.amount >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                {p.amount >= 0 ? "+" : ""}
                {pt(p.amount)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="glass divide-y divide-black/5 rounded-2xl">
          {rentals.map((r) => {
            const expired =
              r.status === "PENDING" && r.expiresAt && new Date(r.expiresAt) < new Date();
            const label = expired ? "만료" : RENTAL_STATUS[r.status];
            return (
              <li key={r.id} className="px-4 py-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <RentalLabel
                      country={r.country}
                      service={r.service}
                      phone={phoneFmt(r.phoneNumber)}
                    />
                    <p className="font-num mt-0.5 text-xs text-zinc-400">{ymdhm(r.createdAt)}</p>
                  </div>
                  <span
                    className={`shrink-0 ${r.status === "RECEIVED" ? "text-emerald-600" : "text-zinc-400"}`}
                  >
                    {label}
                  </span>
                </div>
                {r.smsCode && (
                  <div className="mt-2 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2">
                    <span className="text-xs text-emerald-700">인증번호</span>
                    <span className="font-num text-base font-bold tracking-wider text-emerald-700">
                      {r.smsCode}
                    </span>
                    <CopyButton text={r.smsCode} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {lastPage > 1 && (
        <nav className="flex items-center justify-center gap-2" aria-label="페이지">
          {page > 1 && (
            <Link href={`/history?tab=${tab}&page=${page - 1}`} className="glass rounded-lg px-3 py-1.5 text-sm hover:bg-white/70">
              이전
            </Link>
          )}
          <span className="font-num text-sm text-zinc-500">
            {page} / {lastPage}
          </span>
          {page < lastPage && (
            <Link href={`/history?tab=${tab}&page=${page + 1}`} className="glass rounded-lg px-3 py-1.5 text-sm hover:bg-white/70">
              다음
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}

function Tab({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
        active ? "bg-zinc-900 text-white" : "glass text-zinc-600 hover:bg-white/70"
      }`}
    >
      {label}
    </Link>
  );
}
