import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { won, pt, ymdhm } from "@/lib/format";
import { confirmCharge, cancelCharge } from "../actions";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "PENDING", label: "입금대기" },
  { key: "COMPLETED", label: "충전완료" },
  { key: "CANCELED", label: "취소" },
  { key: "ALL", label: "전체" },
] as const;

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
  const where = status === "ALL" ? {} : { status: status as "PENDING" | "COMPLETED" | "CANCELED" };

  const orders = await prisma.chargeOrder.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { user: { select: { loginId: true, name: true } } },
    take: 100,
  });

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

      {orders.length === 0 ? (
        <p className="text-sm text-zinc-500">해당 내역이 없습니다.</p>
      ) : (
        <ul className="glass divide-y divide-black/5 rounded-2xl">
          {orders.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 text-sm">
              <div>
                <p>
                  <b>{o.user.name || o.user.loginId}</b> · 입금자 <b>{o.depositName || "-"}</b>
                </p>
                <p className="font-num text-xs text-zinc-400">
                  {won(o.amount)} → {pt(o.chargePoint)} · {ymdhm(o.createdAt)}
                </p>
              </div>
              {o.status === "PENDING" ? (
                <div className="flex gap-2">
                  <form action={confirmCharge}>
                    <input type="hidden" name="id" value={o.id} />
                    <button className="rounded-lg bg-emerald-600 px-3 py-1.5 font-medium text-white transition hover:bg-emerald-500">
                      입금확인·지급
                    </button>
                  </form>
                  <form action={cancelCharge}>
                    <input type="hidden" name="id" value={o.id} />
                    <button className="rounded-lg border border-black/10 px-3 py-1.5 hover:bg-black/5">
                      취소
                    </button>
                  </form>
                </div>
              ) : (
                <span
                  className={
                    o.status === "COMPLETED" ? "text-emerald-600" : "text-red-500"
                  }
                >
                  {STATUS_LABEL[o.status]}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
