import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { pt, won, ymd, ymdhm, phoneFmt, dateRange } from "@/lib/format";
import { expireStaleRentals } from "@/lib/rentals";
import RentalLabel from "@/components/RentalLabel";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "ALL", label: "전체" },
  { key: "RECEIVED", label: "성공" },
  { key: "CANCELED", label: "실패" },
  { key: "PENDING", label: "대기" },
] as const;

const PER = 60;

function statusBadge(status: string, expiresAt: Date | null) {
  if (status === "RECEIVED")
    return { label: "성공", cls: "bg-emerald-100 text-emerald-700" };
  if (status === "CANCELED") return { label: "실패", cls: "bg-red-100 text-red-600" };
  if (status === "EXPIRED") return { label: "만료", cls: "bg-zinc-200 text-zinc-500" };
  if (status === "FINISHED") return { label: "완료", cls: "bg-zinc-200 text-zinc-500" };
  if (status === "PENDING") {
    if (expiresAt && new Date(expiresAt) < new Date())
      return { label: "만료", cls: "bg-zinc-200 text-zinc-500" };
    return { label: "대기", cls: "bg-amber-100 text-amber-700" };
  }
  return { label: status, cls: "bg-zinc-200 text-zinc-500" };
}

export default async function AdminRentalsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string; from?: string; to?: string }>;
}) {
  await requireAdmin();
  await expireStaleRentals(); // 지난 수신대기건 만료 처리
  const sp = await searchParams;
  const status = (sp.status || "ALL").toUpperCase();
  const q = (sp.q || "").trim();
  const from = (sp.from || "").trim();
  const to = (sp.to || "").trim();
  const page = Math.max(1, Number(sp.page) || 1);
  const createdAt = dateRange(from, to);
  const carry = `${q ? `&q=${encodeURIComponent(q)}` : ""}${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}`;

  const where = {
    ...(status === "ALL"
      ? {}
      : { status: status as "RECEIVED" | "CANCELED" | "PENDING" }),
    ...(createdAt ? { createdAt } : {}),
    ...(q
      ? {
          OR: [
            { phoneNumber: { contains: q } },
            { user: { loginId: { contains: q, mode: "insensitive" as const } } },
            { user: { name: { contains: q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const [rentals, count] = await Promise.all([
    prisma.numberRental.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { loginId: true, name: true } } },
      skip: (page - 1) * PER,
      take: PER,
    }),
    prisma.numberRental.count({ where }),
  ]);
  const lastPage = Math.max(1, Math.ceil(count / PER));

  // 날짜별 그룹
  const groups = new Map<string, typeof rentals>();
  for (const r of rentals) {
    const d = ymd(r.createdAt);
    if (!groups.has(d)) groups.set(d, []);
    groups.get(d)!.push(r);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <i className="fa-solid fa-mobile-screen-button text-emerald-600" aria-hidden /> 발급 내역
        </h1>
        <Link href="/admin" className="text-sm text-zinc-500 hover:text-zinc-900">
          ← 관리자 홈
        </Link>
      </div>

      <form action="/admin/rentals" method="GET" className="space-y-2">
        <input type="hidden" name="status" value={status} />
        <div className="flex gap-2">
          <div className="glass flex flex-1 items-center gap-3 rounded-xl px-3.5 py-2.5">
            <i className="fa-solid fa-magnifying-glass text-zinc-400" aria-hidden />
            <input
              name="q"
              defaultValue={q}
              placeholder="회원 아이디·이름·번호 검색"
              aria-label="검색"
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
          <button className="rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-700">
            검색
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-zinc-500">기간</span>
          <input type="date" name="from" defaultValue={from} aria-label="시작일" className="glass font-num rounded-lg px-3 py-1.5 outline-none" />
          <span className="text-zinc-400">~</span>
          <input type="date" name="to" defaultValue={to} aria-label="종료일" className="glass font-num rounded-lg px-3 py-1.5 outline-none" />
          {(from || to) && (
            <Link href={`/admin/rentals?status=${status}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className="text-xs text-zinc-400 hover:text-zinc-600">
              기간 해제
            </Link>
          )}
        </div>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="상태 필터" className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={`/admin/rentals?status=${t.key}${carry}`}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                status === t.key ? "bg-zinc-900 text-white" : "glass text-zinc-600 hover:bg-white/70"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
        <p className="font-num text-sm text-zinc-500">총 {count.toLocaleString("ko-KR")}건</p>
      </div>

      {rentals.length === 0 ? (
        <p className="text-sm text-zinc-500">해당 내역이 없습니다.</p>
      ) : (
        <div className="space-y-5">
          {[...groups.entries()].map(([date, list]) => (
            <section key={date}>
              <h3 className="mb-2 px-1 text-sm font-semibold text-zinc-500">
                {date} <span className="font-normal text-zinc-400">· {list.length}건</span>
              </h3>
              <ul className="space-y-2">
                {list.map((r) => {
                  const b = statusBadge(r.status, r.expiresAt);
                  return (
                    <li key={r.id} className="glass rounded-2xl p-3.5">
                      {/* 상단: 회원 + 상태 배지(오른쪽 분리) */}
                      <div className="flex items-center justify-between gap-2">
                        <Link
                          href={`/admin/members/${r.userId}`}
                          className="font-num min-w-0 truncate text-sm font-semibold text-emerald-700 hover:underline"
                        >
                          {r.user.name || r.user.loginId}
                        </Link>
                        <span
                          className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ${b.cls}`}
                        >
                          {b.label}
                        </span>
                      </div>
                      {/* 국가/서비스 */}
                      <div className="mt-1.5">
                        <RentalLabel country={r.country} service={r.service} />
                      </div>
                      {/* 하단: 번호·코드·시간(왼쪽) + 금액(오른쪽) */}
                      <div className="mt-1.5 flex items-end justify-between gap-3">
                        <p className="font-num min-w-0 text-xs text-zinc-400">
                          {r.phoneNumber ? phoneFmt(r.phoneNumber) : "-"}
                          {r.smsCode ? ` · 코드 ${r.smsCode}` : ""}
                          <br className="sm:hidden" />
                          <span className="hidden sm:inline"> · </span>
                          {ymdhm(r.createdAt).slice(11)}
                        </p>
                        <div className="shrink-0 text-right">
                          {r.status === "RECEIVED" ? (
                            <>
                              <p className="font-num text-sm font-bold">{pt(r.pricePoint)}</p>
                              <p className="font-num text-xs text-zinc-400">원가 {won(r.costKrw)}</p>
                            </>
                          ) : (
                            <p className="font-num text-xs text-zinc-400">차감 없음</p>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {lastPage > 1 && (
        <nav className="flex items-center justify-center gap-2" aria-label="페이지">
          {page > 1 && (
            <Link href={`/admin/rentals?status=${status}${carry}&page=${page - 1}`} className="glass rounded-lg px-3 py-1.5 text-sm hover:bg-white/70">
              이전
            </Link>
          )}
          <span className="font-num text-sm text-zinc-500">
            {page} / {lastPage}
          </span>
          {page < lastPage && (
            <Link href={`/admin/rentals?status=${status}${carry}&page=${page + 1}`} className="glass rounded-lg px-3 py-1.5 text-sm hover:bg-white/70">
              다음
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
