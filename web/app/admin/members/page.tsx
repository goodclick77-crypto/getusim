import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { pt, ymd, dateRange } from "@/lib/format";

export const dynamic = "force-dynamic";

const SORTS = [
  { key: "recent", label: "최근 가입" },
  { key: "point", label: "포인트 많은순" },
  { key: "point_asc", label: "포인트 적은순" },
] as const;

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; from?: string; to?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const q = (sp.q || "").trim();
  const from = (sp.from || "").trim();
  const to = (sp.to || "").trim();
  const sort = SORTS.some((s) => s.key === sp.sort) ? sp.sort! : "recent";
  const createdAt = dateRange(from, to); // 가입일 기준 기간

  const where = {
    ...(q
      ? {
          OR: [
            { loginId: { contains: q, mode: "insensitive" as const } },
            { name: { contains: q, mode: "insensitive" as const } },
            { phone: { contains: q } },
            { email: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(createdAt ? { createdAt } : {}),
  };

  const orderBy =
    sort === "point"
      ? { point: "desc" as const }
      : sort === "point_asc"
        ? { point: "asc" as const }
        : { createdAt: "desc" as const };

  const [members, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy,
      take: 100,
      include: { _count: { select: { inquiries: true, chargeOrders: true } } },
    }),
    prisma.user.count({ where }),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <i className="fa-solid fa-users text-emerald-600" aria-hidden /> 회원 관리
        </h1>
        <Link href="/admin" className="text-sm text-zinc-500 hover:text-zinc-900">
          ← 관리자 홈
        </Link>
      </div>

      <form action="/admin/members" method="GET" className="space-y-2">
        <div className="flex gap-2">
          <div className="glass flex flex-1 items-center gap-3 rounded-xl px-3.5 py-2.5">
            <i className="fa-solid fa-magnifying-glass text-zinc-400" aria-hidden />
            <input
              name="q"
              defaultValue={q}
              placeholder="아이디 · 이름 · 휴대폰 · 이메일 검색"
              aria-label="회원 검색"
              className="w-full bg-transparent outline-none"
            />
          </div>
          <input type="hidden" name="sort" value={sort} />
          <button className="rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-700">
            검색
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-zinc-500">가입기간</span>
          <input
            type="date"
            name="from"
            defaultValue={from}
            aria-label="시작일"
            className="glass font-num rounded-lg px-3 py-1.5 outline-none"
          />
          <span className="text-zinc-400">~</span>
          <input
            type="date"
            name="to"
            defaultValue={to}
            aria-label="종료일"
            className="glass font-num rounded-lg px-3 py-1.5 outline-none"
          />
          {(from || to) && (
            <Link
              href={`/admin/members?sort=${sort}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className="text-xs text-zinc-400 hover:text-zinc-600"
            >
              기간 해제
            </Link>
          )}
        </div>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="정렬" className="flex flex-wrap gap-2">
          {SORTS.map((s) => (
            <Link
              key={s.key}
              href={`/admin/members?sort=${s.key}${q ? `&q=${encodeURIComponent(q)}` : ""}${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}`}
              className={`rounded-xl px-3.5 py-1.5 text-sm font-medium transition ${
                sort === s.key ? "bg-zinc-900 text-white" : "glass text-zinc-600 hover:bg-white/70"
              }`}
            >
              {s.label}
            </Link>
          ))}
        </nav>
        <p className="font-num text-sm text-zinc-500">
          {q ? `"${q}" 검색결과 ` : "전체 "}
          {total.toLocaleString("ko-KR")}명 {total > 100 && "(100명 표시)"}
        </p>
      </div>

      <div className="glass overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-black/5 text-xs text-zinc-500">
                <th className="px-4 py-2.5 text-left font-semibold">아이디</th>
                <th className="px-4 py-2.5 text-left font-semibold">이름</th>
                <th className="px-4 py-2.5 text-left font-semibold">휴대폰</th>
                <th className="px-4 py-2.5 text-right font-semibold">보유P</th>
                <th className="px-4 py-2.5 text-center font-semibold">문의</th>
                <th className="px-4 py-2.5 text-left font-semibold">가입일</th>
                <th className="px-4 py-2.5 text-center font-semibold">상태</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-b border-black/5 last:border-0 hover:bg-black/[0.02]">
                  <td className="px-4 py-2.5">
                    <Link href={`/admin/members/${m.id}`} className="font-num font-medium text-emerald-700 hover:underline">
                      {m.loginId}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">{m.name || "-"}</td>
                  <td className="font-num px-4 py-2.5 text-zinc-600">{m.phone || "-"}</td>
                  <td className="font-num whitespace-nowrap px-4 py-2.5 text-right font-semibold">
                    {pt(m.point)}
                  </td>
                  <td className="font-num px-4 py-2.5 text-center text-zinc-500">
                    {m._count.inquiries}
                  </td>
                  <td className="font-num whitespace-nowrap px-4 py-2.5 text-zinc-500">
                    {ymd(m.createdAt)}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {m.leftAt ? (
                      <span className="rounded-md bg-red-100 px-2 py-0.5 text-xs text-red-600">정지</span>
                    ) : m.role === "ADMIN" ? (
                      <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-xs text-white">관리자</span>
                    ) : (
                      <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">정상</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {members.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-zinc-500">검색 결과가 없습니다.</p>
        )}
      </div>
    </div>
  );
}
