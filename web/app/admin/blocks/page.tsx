import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ymdhm, dateRange } from "@/lib/format";
import { BLOCK_KIND, BLOCK_REASON } from "@/lib/block-log";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;

const hoursAgo = (h: number) => new Date(Date.now() - h * 60 * 60 * 1000);
const hoursSince = (d: Date) => Math.floor((Date.now() - d.getTime()) / 3600000);

// 차단이 아닌 기록(관리자 조치·계좌 확인)은 차단 통계에서 뺀다
const NON_BLOCK = ["ADMIN", "ACCOUNT"];
// 차단 기록 탭의 필터 선택지 — 계좌 확인은 별도 탭이라 제외
const KIND_OPTS = Object.fromEntries(Object.entries(BLOCK_KIND).filter(([k]) => k !== "ACCOUNT"));
const REASON_OPTS = Object.fromEntries(Object.entries(BLOCK_REASON).filter(([k]) => k !== "ACCOUNT_VIEW"));

// 사유별 배지 색 — 공격 성격이 강할수록 진하게
const REASON_BADGE: Record<string, string> = {
  BLOCKED_EMAIL: "bg-amber-100 text-amber-700",
  HONEYPOT: "bg-red-100 text-red-600",
  CAPTCHA: "bg-orange-100 text-orange-700",
  RATE_LIMIT: "bg-violet-100 text-violet-700",
  ACCOUNT_LOCKED: "bg-red-100 text-red-600",
  LOCK_TRIGGERED: "bg-red-100 text-red-600",
  BAD_CODE: "bg-zinc-200 text-zinc-600",
  SUSPEND: "bg-zinc-800 text-white",
  UNSUSPEND: "bg-emerald-100 text-emerald-700",
  DELETE: "bg-zinc-800 text-white",
};

export default async function AdminBlocksPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; kind?: string; reason?: string; from?: string; to?: string; page?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  if (sp.tab === "unpaid") return <UnpaidTab />;
  const q = (sp.q || "").trim();
  const kind = KIND_OPTS[sp.kind || ""] ? sp.kind! : "";
  const reason = REASON_OPTS[sp.reason || ""] ? sp.reason! : "";
  const from = (sp.from || "").trim();
  const to = (sp.to || "").trim();
  const page = Math.max(1, Number(sp.page) || 1);
  const range = dateRange(from, to);

  const where: Prisma.BlockLogWhereInput = {
    kind: kind || { not: "ACCOUNT" }, // 계좌 확인 기록은 별도 탭에서만
    ...(reason && { reason }),
    ...(range && { createdAt: range }),
    ...(q && {
      OR: [
        { email: { contains: q, mode: "insensitive" } },
        { loginId: { contains: q, mode: "insensitive" } },
        { ip: { contains: q } },
        { detail: { contains: q, mode: "insensitive" } },
      ],
    }),
  };

  const day = hoursAgo(24);
  const week = hoursAgo(7 * 24);
  const [logs, filtered, last24h, last7d, topIps, topDomains] = await Promise.all([
    prisma.blockLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.blockLog.count({ where }),
    prisma.blockLog.count({ where: { createdAt: { gte: day }, kind: { notIn: NON_BLOCK } } }),
    prisma.blockLog.count({ where: { createdAt: { gte: week }, kind: { notIn: NON_BLOCK } } }),
    prisma.blockLog.groupBy({
      by: ["ip"],
      where: { createdAt: { gte: week }, kind: { notIn: NON_BLOCK }, ip: { not: "" } },
      _count: { _all: true },
      orderBy: { _count: { ip: "desc" } },
      take: 5,
    }),
    prisma.blockLog.findMany({
      where: { createdAt: { gte: week }, reason: "BLOCKED_EMAIL" },
      select: { email: true },
    }),
  ]);

  // 최근 7일 막힌 이메일 도메인 상위(새 일회용 도메인 파악용)
  const domainCount = new Map<string, number>();
  for (const { email } of topDomains) {
    const d = email.split("@")[1];
    if (d) domainCount.set(d, (domainCount.get(d) || 0) + 1);
  }
  const domains = [...domainCount].sort((a, b) => b[1] - a[1]).slice(0, 5);

  // 현재 필터를 유지한 채 일부만 바꾼 링크
  const qs = (patch: Record<string, string | number>) => {
    const p = new URLSearchParams();
    const cur = { q, kind, reason, from, to, page: "", ...patch };
    for (const [k, v] of Object.entries(cur)) if (v) p.set(k, String(v));
    const s = p.toString();
    return `/admin/blocks${s ? `?${s}` : ""}`;
  };
  const lastPage = Math.max(1, Math.ceil(filtered / PAGE_SIZE));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <i className="fa-solid fa-shield-halved text-emerald-600" aria-hidden /> 차단 내역
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            가입·로그인·문의 등에서 보안 규칙에 막힌 시도와 관리자 이용정지 기록입니다.
          </p>
        </div>
        <Link href="/admin" className="shrink-0 text-sm text-zinc-500 hover:text-zinc-900">
          ← 관리자 홈
        </Link>
      </div>

      <Tabs current="blocks" />

      <section aria-label="차단 통계" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon="fa-clock" label="24시간 차단" value={`${last24h.toLocaleString("ko-KR")}건`} />
        <Stat icon="fa-calendar-week" label="7일 차단" value={`${last7d.toLocaleString("ko-KR")}건`} />
        <div className="glass rounded-2xl p-4">
          <p className="flex items-center gap-2 text-xs text-zinc-500">
            <i className="fa-solid fa-network-wired text-emerald-600" aria-hidden /> 7일 많이 막힌 IP
          </p>
          {topIps.length === 0 ? (
            <p className="mt-1 text-sm text-zinc-400">없음</p>
          ) : (
            <ul className="mt-1 space-y-0.5 text-xs">
              {topIps.map((r) => (
                <li key={r.ip} className="flex justify-between gap-2">
                  <Link href={qs({ q: r.ip })} className="font-num truncate text-emerald-700 hover:underline">
                    {r.ip}
                  </Link>
                  <span className="font-num shrink-0 text-zinc-500">{r._count._all}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="glass rounded-2xl p-4">
          <p className="flex items-center gap-2 text-xs text-zinc-500">
            <i className="fa-solid fa-at text-emerald-600" aria-hidden /> 7일 막힌 메일 도메인
          </p>
          {domains.length === 0 ? (
            <p className="mt-1 text-sm text-zinc-400">없음</p>
          ) : (
            <ul className="mt-1 space-y-0.5 text-xs">
              {domains.map(([d, n]) => (
                <li key={d} className="flex justify-between gap-2">
                  <Link href={qs({ q: `@${d}` })} className="truncate text-emerald-700 hover:underline">
                    {d}
                  </Link>
                  <span className="font-num shrink-0 text-zinc-500">{n}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <form action="/admin/blocks" method="GET" className="space-y-2">
        <div className="flex gap-2">
          <div className="glass flex flex-1 items-center gap-3 rounded-xl px-3.5 py-2.5">
            <i className="fa-solid fa-magnifying-glass text-zinc-400" aria-hidden />
            <input
              name="q"
              defaultValue={q}
              placeholder="이메일 · 아이디 · IP · 상세 검색"
              aria-label="차단 내역 검색"
              className="w-full bg-transparent outline-none"
            />
          </div>
          <button className="rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-700">
            검색
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <select name="kind" defaultValue={kind} aria-label="구분" className="glass rounded-lg px-2 py-1.5 outline-none">
            <option value="">구분 전체</option>
            {Object.entries(KIND_OPTS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select name="reason" defaultValue={reason} aria-label="사유" className="glass rounded-lg px-2 py-1.5 outline-none">
            <option value="">사유 전체</option>
            {Object.entries(REASON_OPTS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <input
              type="date"
              name="from"
              defaultValue={from}
              aria-label="시작일"
              className="glass font-num min-w-0 flex-1 rounded-lg px-2 py-1.5 outline-none"
            />
            <span className="shrink-0 text-zinc-400">~</span>
            <input
              type="date"
              name="to"
              defaultValue={to}
              aria-label="종료일"
              className="glass font-num min-w-0 flex-1 rounded-lg px-2 py-1.5 outline-none"
            />
          </div>
          {(q || kind || reason || from || to) && (
            <Link href="/admin/blocks" className="shrink-0 text-xs text-zinc-400 hover:text-zinc-600">
              필터 해제
            </Link>
          )}
        </div>
      </form>

      <p className="text-xs text-zinc-500">
        {filtered.toLocaleString("ko-KR")}건 · 같은 IP·사유·대상의 반복 시도는 30초에 1건만 기록됩니다.
      </p>

      <div className="glass overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-black/5 text-xs text-zinc-500">
                <th className="px-4 py-2.5 text-left font-semibold">시각</th>
                <th className="px-4 py-2.5 text-left font-semibold">구분</th>
                <th className="px-4 py-2.5 text-left font-semibold">사유</th>
                <th className="px-4 py-2.5 text-left font-semibold">대상</th>
                <th className="px-4 py-2.5 text-left font-semibold">IP</th>
                <th className="px-4 py-2.5 text-left font-semibold">상세</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-black/5 align-top last:border-0 hover:bg-black/[0.02]">
                  <td className="font-num whitespace-nowrap px-4 py-2.5 text-zinc-600">{ymdhm(l.createdAt)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5">{BLOCK_KIND[l.kind] ?? l.kind}</td>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${REASON_BADGE[l.reason] ?? "bg-zinc-100 text-zinc-600"}`}>
                      {BLOCK_REASON[l.reason] ?? l.reason}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    {l.loginId &&
                      (l.userId ? (
                        <Link href={`/admin/members/${l.userId}`} className="block font-medium text-emerald-700 hover:underline">
                          {l.loginId}
                        </Link>
                      ) : (
                        <span className="block font-medium">{l.loginId}</span>
                      ))}
                    {l.email && <span className="block break-all text-xs text-zinc-500">{l.email}</span>}
                    {!l.loginId && !l.email && <span className="text-zinc-400">-</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    {l.ip ? (
                      <Link href={qs({ q: l.ip })} className="font-num text-zinc-600 hover:text-emerald-700 hover:underline">
                        {l.ip}
                      </Link>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-zinc-600">
                    {l.detail || "-"}
                    {l.userAgent && (
                      <span className="mt-0.5 block max-w-[320px] truncate text-xs text-zinc-400" title={l.userAgent}>
                        {l.userAgent}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {logs.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-zinc-500">차단 기록이 없거나 검색 결과가 없습니다.</p>
        )}
      </div>

      {lastPage > 1 && (
        <nav aria-label="페이지" className="flex items-center justify-center gap-3 text-sm">
          {page > 1 && (
            <Link href={qs({ page: page - 1 })} className="rounded-lg px-3 py-1.5 hover:bg-black/5">
              ← 이전
            </Link>
          )}
          <span className="font-num text-zinc-500">
            {page} / {lastPage}
          </span>
          {page < lastPage && (
            <Link href={qs({ page: page + 1 })} className="rounded-lg px-3 py-1.5 hover:bg-black/5">
              다음 →
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}

function Tabs({ current }: { current: "blocks" | "unpaid" }) {
  const tab = (key: "blocks" | "unpaid", href: string, icon: string, label: string) => (
    <Link
      href={href}
      aria-current={current === key ? "page" : undefined}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition ${
        current === key ? "bg-zinc-900 text-white" : "bg-black/5 text-zinc-600 hover:bg-black/10"
      }`}
    >
      <i className={`fa-solid ${icon}`} aria-hidden /> {label}
    </Link>
  );
  return (
    <nav aria-label="차단 내역 구분" className="flex gap-2">
      {tab("blocks", "/admin/blocks", "fa-ban", "차단 기록")}
      {tab("unpaid", "/admin/blocks?tab=unpaid", "fa-building-columns", "계좌 확인 후 미입금")}
    </nav>
  );
}

const UNPAID_DAYS = 30;

/** 계좌번호를 본 뒤(첫 확인 이후) 충전완료가 한 건도 없는 회원 — 통장묶기 사전 탐색 추적용 */
async function UnpaidTab() {
  const since = hoursAgo(UNPAID_DAYS * 24);
  const views = await prisma.blockLog.groupBy({
    by: ["userId"],
    where: { reason: "ACCOUNT_VIEW", userId: { not: null }, createdAt: { gte: since } },
    _min: { createdAt: true },
    _max: { createdAt: true },
    _count: { _all: true },
  });
  const ids = views.map((v) => v.userId!);
  const [users, completed, pending, lastViews] = await Promise.all([
        prisma.user.findMany({
          where: { id: { in: ids } },
          select: { id: true, loginId: true, name: true, email: true, createdAt: true, leftAt: true },
        }),
        prisma.chargeOrder.findMany({
          where: { userId: { in: ids }, status: "COMPLETED" },
          select: { userId: true, paidAt: true, createdAt: true },
        }),
        prisma.chargeOrder.findMany({
          where: { userId: { in: ids }, createdAt: { gte: since }, status: { not: "COMPLETED" } },
          select: { userId: true, depositName: true, amount: true, status: true },
          orderBy: { createdAt: "desc" },
        }),
        prisma.blockLog.findMany({
          where: { reason: "ACCOUNT_VIEW", userId: { in: ids } },
          orderBy: { createdAt: "desc" },
          distinct: ["userId"],
          select: { userId: true, ip: true },
        }),
      ]);

  const userById = new Map(users.map((u) => [u.id, u]));
  const ipById = new Map(lastViews.map((l) => [l.userId!, l.ip]));
  const rows = views
    .map((v) => {
      const first = v._min.createdAt!;
      const paidAfter = completed.some(
        (c) => c.userId === v.userId && (c.paidAt ?? c.createdAt) >= first,
      );
      return {
        user: userById.get(v.userId!),
        userId: v.userId!,
        first,
        last: v._max.createdAt!,
        count: v._count._all,
        paidAfter,
        prevPaid: completed.filter((c) => c.userId === v.userId && (c.paidAt ?? c.createdAt) < first).length,
        orders: pending.filter((o) => o.userId === v.userId),
        ip: ipById.get(v.userId!) || "",
        hours: hoursSince(v._max.createdAt!),
      };
    })
    .filter((r) => !r.paidAfter)
    .sort((a, b) => b.last.getTime() - a.last.getTime());

  const over24 = rows.filter((r) => r.hours >= 24).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <i className="fa-solid fa-shield-halved text-emerald-600" aria-hidden /> 차단 내역
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            최근 {UNPAID_DAYS}일 동안 입금 계좌를 확인하고 그 뒤로 충전완료가 없는 회원입니다.
          </p>
        </div>
        <Link href="/admin" className="shrink-0 text-sm text-zinc-500 hover:text-zinc-900">
          ← 관리자 홈
        </Link>
      </div>

      <Tabs current="unpaid" />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat icon="fa-eye" label="계좌 확인 후 미입금" value={`${rows.length}명`} />
        <Stat icon="fa-hourglass-end" label="24시간 넘게 미입금" value={`${over24}명`} />
        <Stat icon="fa-user-plus" label="충전 이력 없는 회원" value={`${rows.filter((r) => r.prevPaid === 0).length}명`} />
      </section>

      <p className="text-xs text-zinc-500">
        방금 확인한 회원은 아직 입금 전일 수 있습니다. 24시간이 지나도 입금이 없고, 충전 이력도 없는 신규 가입자를 눈여겨보세요.
      </p>

      <div className="glass overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-black/5 text-xs text-zinc-500">
                <th className="px-4 py-2.5 text-left font-semibold">회원</th>
                <th className="px-4 py-2.5 text-left font-semibold">계좌 확인</th>
                <th className="px-4 py-2.5 text-left font-semibold">미입금 경과</th>
                <th className="px-4 py-2.5 text-left font-semibold">충전 신청(미완료)</th>
                <th className="px-4 py-2.5 text-left font-semibold">이전 충전</th>
                <th className="px-4 py-2.5 text-left font-semibold">IP</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.userId} className="border-b border-black/5 align-top last:border-0 hover:bg-black/[0.02]">
                  <td className="px-4 py-2.5">
                    <Link href={`/admin/members/${r.userId}`} className="block font-medium text-emerald-700 hover:underline">
                      {r.user?.loginId ?? `#${r.userId}`}
                    </Link>
                    <span className="block break-all text-xs text-zinc-500">
                      {r.user?.name || "-"} · {r.user?.email || "-"}
                    </span>
                    <span className="block text-xs text-zinc-400">
                      가입 {r.user ? ymdhm(r.user.createdAt) : "삭제됨"}
                      {r.user?.leftAt && <span className="ml-1 text-red-500">정지</span>}
                    </span>
                  </td>
                  <td className="font-num whitespace-nowrap px-4 py-2.5 text-zinc-600">
                    {ymdhm(r.last)}
                    <span className="block text-xs text-zinc-400">
                      {r.count}회{r.count > 1 ? ` · 처음 ${ymdhm(r.first)}` : ""}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <span
                      className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                        r.hours >= 24 ? "bg-red-100 text-red-600" : "bg-zinc-100 text-zinc-600"
                      }`}
                    >
                      {r.hours >= 24 ? `${Math.floor(r.hours / 24)}일` : `${r.hours}시간`}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-zinc-600">
                    {r.orders.length === 0
                      ? "없음"
                      : r.orders.slice(0, 3).map((o, i) => (
                          <span key={i} className="block">
                            {o.depositName} · {o.amount.toLocaleString("ko-KR")}원 ·{" "}
                            {o.status === "PENDING" ? "입금대기" : "취소"}
                          </span>
                        ))}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs">
                    {r.prevPaid > 0 ? (
                      <span className="text-zinc-500">{r.prevPaid}건</span>
                    ) : (
                      <span className="font-medium text-amber-700">없음</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {r.ip ? (
                      <Link
                        href={`/admin/blocks?q=${encodeURIComponent(r.ip)}`}
                        className="font-num text-zinc-600 hover:text-emerald-700 hover:underline"
                      >
                        {r.ip}
                      </Link>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-zinc-500">
            계좌를 확인하고 입금하지 않은 회원이 없습니다. (계좌 확인 기록은 이 기능 배포 이후부터 쌓입니다)
          </p>
        )}
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="glass rounded-2xl p-4">
      <p className="flex items-center gap-2 text-xs text-zinc-500">
        <i className={`fa-solid ${icon} text-emerald-600`} aria-hidden /> {label}
      </p>
      <p className="font-num mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}
