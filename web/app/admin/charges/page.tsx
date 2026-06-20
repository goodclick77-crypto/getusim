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

const PER = 60;

export default async function AdminChargesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const status = (sp.status || "PENDING").toUpperCase();
  const q = (sp.q || "").trim();
  const page = Math.max(1, Number(sp.page) || 1);

  const where = {
    ...(status === "ALL"
      ? {}
      : { status: status as "PENDING" | "COMPLETED" | "CANCELED" }),
    ...(q
      ? {
          OR: [
            { depositName: { contains: q, mode: "insensitive" as const } },
            { user: { loginId: { contains: q, mode: "insensitive" as const } } },
            { user: { name: { contains: q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const [orders, count, deposits] = await Promise.all([
    prisma.chargeOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { loginId: true, name: true } } },
      skip: (page - 1) * PER,
      take: PER,
    }),
    prisma.chargeOrder.count({ where }),
    prisma.depositLog.findMany({ orderBy: { createdAt: "desc" }, take: 12 }),
  ]);
  const lastPage = Math.max(1, Math.ceil(count / PER));

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

      <form action="/admin/charges" method="GET" className="flex gap-2">
        <input type="hidden" name="status" value={status} />
        <div className="glass flex flex-1 items-center gap-3 rounded-xl px-3.5 py-2.5">
          <i className="fa-solid fa-magnifying-glass text-zinc-400" aria-hidden />
          <input
            name="q"
            defaultValue={q}
            placeholder="회원 아이디·이름·입금자명 검색"
            aria-label="검색"
            className="w-full bg-transparent text-sm outline-none"
          />
        </div>
        <button className="rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-700">
          검색
        </button>
      </form>

      {deposits.length > 0 && (
        <details className="glass rounded-2xl p-4">
          <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
            <i className="fa-solid fa-bell text-emerald-600" aria-hidden /> 자동 입금 감지
            <span className="font-num text-xs font-normal text-zinc-400">최근 {deposits.length}건</span>
            {deposits.some((d) => !d.matched && d.amount > 0) && (
              <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                미매칭 {deposits.filter((d) => !d.matched && d.amount > 0).length}
              </span>
            )}
          </summary>
          <ul className="mt-3 space-y-1.5">
            {deposits.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between gap-2 rounded-lg bg-black/[0.02] px-3 py-2 text-sm"
              >
                <span className="flex items-center gap-2">
                  {d.matched ? (
                    <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-700">
                      자동지급
                    </span>
                  ) : (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                      미매칭
                    </span>
                  )}
                  <span className="font-medium">{d.depositorName || "?"}</span>
                  <span className="font-num text-zinc-500">{won(d.amount)}</span>
                </span>
                <span className="font-num text-xs text-zinc-400">{ymdhm(d.createdAt).slice(5)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-zinc-400">
            미매칭 건은 입금자명·금액이 주문과 다른 경우입니다. 아래 목록에서 직접 ‘지급’ 처리하세요.
          </p>
        </details>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="상태 필터" className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={`/admin/charges?status=${t.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
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
          총 {count.toLocaleString("ko-KR")}건 · 이 페이지 {won(sumAmount)}
        </p>
      </div>

      {orders.length === 0 ? (
        <p className="text-sm text-zinc-500">해당 내역이 없습니다.</p>
      ) : (
        <div className="space-y-5">
          {[...groups.entries()].map(([date, list]) => (
            <DateGroup key={date} date={date} list={list} />
          ))}
        </div>
      )}

      {lastPage > 1 && (
        <nav className="flex items-center justify-center gap-2" aria-label="페이지">
          {page > 1 && (
            <Link
              href={`/admin/charges?status=${status}${q ? `&q=${encodeURIComponent(q)}` : ""}&page=${page - 1}`}
              className="glass rounded-lg px-3 py-1.5 text-sm hover:bg-white/70"
            >
              이전
            </Link>
          )}
          <span className="font-num text-sm text-zinc-500">
            {page} / {lastPage}
          </span>
          {page < lastPage && (
            <Link
              href={`/admin/charges?status=${status}${q ? `&q=${encodeURIComponent(q)}` : ""}&page=${page + 1}`}
              className="glass rounded-lg px-3 py-1.5 text-sm hover:bg-white/70"
            >
              다음
            </Link>
          )}
        </nav>
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
  const dayTotal = list.reduce((a, o) => a + o.amount, 0);
  return (
    <section>
      <h3 className="mb-2 flex items-center justify-between px-1">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-zinc-500">
          <i className="fa-regular fa-calendar" aria-hidden /> {date}
          <span className="font-normal text-zinc-400">· {list.length}건</span>
        </span>
        <span className="font-num text-xs text-zinc-400">{won(dayTotal)}</span>
      </h3>
      <ul className="space-y-2">
        {list.map((o) => {
          const pending = o.status === "PENDING";
          return (
            <li
              key={o.id}
              className={`glass flex items-center gap-3 rounded-2xl p-4 ${
                pending ? "border-l-4 border-amber-400" : ""
              }`}
            >
              {/* 입금자 / 회원 */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-base font-bold">
                    {o.depositName || "(입금자명 없음)"}
                  </span>
                  {pending && (
                    <span className="shrink-0 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                      입금대기
                    </span>
                  )}
                </div>
                <p className="font-num mt-0.5 truncate text-xs text-zinc-400">
                  {o.user.name || o.user.loginId} · {ymdhm(o.createdAt).slice(11)}
                </p>
              </div>

              {/* 금액 / 지급포인트 */}
              <div className="shrink-0 text-right">
                <p className="font-num text-lg font-bold tracking-tight">{won(o.amount)}</p>
                <p className="font-num text-xs text-emerald-600">{pt(o.chargePoint)}</p>
              </div>

              {/* 처리 */}
              <div className="flex w-[5.5rem] shrink-0 justify-end">
                {pending ? (
                  <div className="flex flex-col gap-1.5">
                    <form action={confirmCharge}>
                      <input type="hidden" name="id" value={o.id} />
                      <button className="w-full whitespace-nowrap rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-500">
                        지급
                      </button>
                    </form>
                    <form action={cancelCharge}>
                      <input type="hidden" name="id" value={o.id} />
                      <button className="w-full rounded-lg border border-black/10 px-3 py-1 text-xs text-zinc-500 hover:bg-black/5">
                        취소
                      </button>
                    </form>
                  </div>
                ) : (
                  <span
                    className={`rounded-md px-2 py-1 text-xs font-medium ${STATUS_BADGE[o.status]}`}
                  >
                    {STATUS_LABEL[o.status]}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
