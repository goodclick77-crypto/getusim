import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ymdhm, dateRange } from "@/lib/format";
import { BLOCK_KIND, BLOCK_REASON } from "@/lib/block-log";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;

const hoursAgo = (h: number) => new Date(Date.now() - h * 60 * 60 * 1000);

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
  searchParams: Promise<{ q?: string; kind?: string; reason?: string; from?: string; to?: string; page?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const q = (sp.q || "").trim();
  const kind = BLOCK_KIND[sp.kind || ""] ? sp.kind! : "";
  const reason = BLOCK_REASON[sp.reason || ""] ? sp.reason! : "";
  const from = (sp.from || "").trim();
  const to = (sp.to || "").trim();
  const page = Math.max(1, Number(sp.page) || 1);
  const range = dateRange(from, to);

  const where: Prisma.BlockLogWhereInput = {
    ...(kind && { kind }),
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
    prisma.blockLog.count({ where: { createdAt: { gte: day }, kind: { not: "ADMIN" } } }),
    prisma.blockLog.count({ where: { createdAt: { gte: week }, kind: { not: "ADMIN" } } }),
    prisma.blockLog.groupBy({
      by: ["ip"],
      where: { createdAt: { gte: week }, kind: { not: "ADMIN" }, ip: { not: "" } },
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
            {Object.entries(BLOCK_KIND).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select name="reason" defaultValue={reason} aria-label="사유" className="glass rounded-lg px-2 py-1.5 outline-none">
            <option value="">사유 전체</option>
            {Object.entries(BLOCK_REASON).map(([k, v]) => (
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
