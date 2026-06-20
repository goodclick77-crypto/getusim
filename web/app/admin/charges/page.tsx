import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { won, pt, ymd, ymdhm } from "@/lib/format";
import { confirmCharge, cancelCharge } from "../actions";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "PENDING", label: "입금대기" },
  { key: "COMPLETED", label: "충전완료" },
  { key: "CANCELED", label: "취소" },
  { key: "ALL", label: "전체" },
] as const;

const STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  CANCELED: "bg-zinc-200 text-zinc-500",
};
const STATUS_LABEL: Record<string, string> = {
  PENDING: "입금대기",
  COMPLETED: "충전완료",
  CANCELED: "취소",
};

export default async function AdminChargesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const status = (sp.status || "PENDING").toUpperCase();
  const where =
    status === "ALL" ? {} : { status: status as "PENDING" | "COMPLETED" | "CANCELED" };

  const orders = await prisma.chargeOrder.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { user: { select: { loginId: true, name: true } } },
    take: 200,
  });

  // 날짜별 그룹
  const groups = new Map<string, typeof orders>();
  for (const o of orders) {
    const d = ymd(o.createdAt);
    if (!groups.has(d)) groups.set(d, []);
    groups.get(d)!.push(o);
  }

  const sumAmount = orders.reduce((a, o) => a + o.amount, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <i className="fa-solid fa-building-columns text-emerald-600" aria-hidden /> 입금 확인
        </h1>
        <Link href="/admin" className="text-sm text-zinc-500 hover:text-zinc-900">
          ← 관리자 홈
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="상태 필터" className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={`/admin/charges?status=${t.key}`}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                status === t.key
                  ? "bg-zinc-900 text-white"
                  : "glass text-zinc-600 hover:bg-white/70"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
        <p className="font-num text-sm text-zinc-500">
          {orders.length}건 · 합계 {won(sumAmount)}
        </p>
      </div>

      {orders.length === 0 ? (
        <p className="text-sm text-zinc-500">해당 내역이 없습니다.</p>
      ) : (
        <div className="glass overflow-hidden rounded-2xl">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-black/5 text-xs text-zinc-500">
                  <th className="px-4 py-2.5 text-left font-semibold">시간</th>
                  <th className="px-4 py-2.5 text-left font-semibold">회원</th>
                  <th className="px-4 py-2.5 text-left font-semibold">입금자명</th>
                  <th className="px-4 py-2.5 text-right font-semibold">금액</th>
                  <th className="px-4 py-2.5 text-right font-semibold">지급P</th>
                  <th className="px-4 py-2.5 text-center font-semibold">처리</th>
                </tr>
              </thead>
              <tbody>
                {[...groups.entries()].map(([date, list]) => (
                  <DateGroup key={date} date={date} list={list} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function DateGroup({
  date,
  list,
}: {
  date: string;
  list: {
    id: number;
    amount: number;
    chargePoint: number;
    depositName: string;
    status: string;
    createdAt: Date;
    user: { loginId: string; name: string };
  }[];
}) {
  return (
    <>
      <tr className="bg-black/[0.04]">
        <td colSpan={6} className="font-num px-4 py-1.5 text-xs font-semibold text-zinc-500">
          {date} · {list.length}건
        </td>
      </tr>
      {list.map((o) => (
        <tr key={o.id} className="border-b border-black/5 last:border-0 hover:bg-black/[0.02]">
          <td className="font-num whitespace-nowrap px-4 py-2.5 text-zinc-500">
            {ymdhm(o.createdAt).slice(11)}
          </td>
          <td className="px-4 py-2.5 font-medium">{o.user.name || o.user.loginId}</td>
          <td className="px-4 py-2.5">{o.depositName || "-"}</td>
          <td className="font-num whitespace-nowrap px-4 py-2.5 text-right">{won(o.amount)}</td>
          <td className="font-num whitespace-nowrap px-4 py-2.5 text-right text-emerald-700">
            {pt(o.chargePoint)}
          </td>
          <td className="px-4 py-2.5 text-center">
            {o.status === "PENDING" ? (
              <div className="flex justify-center gap-1.5">
                <form action={confirmCharge}>
                  <input type="hidden" name="id" value={o.id} />
                  <button className="whitespace-nowrap rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-emerald-500">
                    지급
                  </button>
                </form>
                <form action={cancelCharge}>
                  <input type="hidden" name="id" value={o.id} />
                  <button className="rounded-lg border border-black/10 px-2.5 py-1 text-xs hover:bg-black/5">
                    취소
                  </button>
                </form>
              </div>
            ) : (
              <span
                className={`rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[o.status]}`}
              >
                {STATUS_LABEL[o.status]}
              </span>
            )}
          </td>
        </tr>
      ))}
    </>
  );
}
