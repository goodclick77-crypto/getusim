import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ymdhm } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminLoginsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const q = (sp.q || "").trim();

  const where = q
    ? {
        OR: [
          { loginId: { contains: q, mode: "insensitive" as const } },
          { name: { contains: q, mode: "insensitive" as const } },
          { phone: { contains: q } },
          { email: { contains: q, mode: "insensitive" as const } },
          { lastLoginIp: { contains: q } },
        ],
        lastLoginAt: { not: null },
      }
    : { lastLoginAt: { not: null } };

  const [users, total, recent24h, recent7d] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: [{ lastLoginAt: "desc" }, { updatedAt: "desc" }],
      take: 100,
    }),
    prisma.user.count({ where: { lastLoginAt: { not: null } } }),
    prisma.user.count({ where: { lastLoginAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
    prisma.user.count({ where: { lastLoginAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } }),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <i className="fa-solid fa-right-to-bracket text-emerald-600" aria-hidden /> 로그인 현황
          </h1>
          <p className="mt-1 text-sm text-zinc-500">최근 로그인한 사용자와 마지막 접속 기록을 확인합니다.</p>
        </div>
        <Link href="/admin" className="text-sm text-zinc-500 hover:text-zinc-900">
          ← 관리자 홈
        </Link>
      </div>

      <section aria-label="로그인 통계" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon="fa-user-check" label="로그인 이력" value={`${total.toLocaleString("ko-KR")}명`} />
        <Stat icon="fa-clock" label="24시간 내" value={`${recent24h.toLocaleString("ko-KR")}명`} />
        <Stat icon="fa-calendar-day" label="7일 내" value={`${recent7d.toLocaleString("ko-KR")}명`} />
        <Stat
          icon="fa-user-clock"
          label="가장 최근"
          value={users[0]?.lastLoginAt ? ymdhm(users[0].lastLoginAt) : "-"}
        />
      </section>

      <form action="/admin/logins" method="GET" className="flex gap-2">
        <div className="glass flex flex-1 items-center gap-3 rounded-xl px-3.5 py-2.5">
          <i className="fa-solid fa-magnifying-glass text-zinc-400" aria-hidden />
          <input
            name="q"
            defaultValue={q}
            placeholder="아이디 · 이름 · 휴대폰 · 이메일 · IP 검색"
            aria-label="로그인 사용자 검색"
            className="w-full bg-transparent outline-none"
          />
        </div>
        <button className="rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-700">
          검색
        </button>
      </form>

      <div className="glass overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-black/5 text-xs text-zinc-500">
                <th className="px-4 py-2.5 text-left font-semibold">아이디</th>
                <th className="px-4 py-2.5 text-left font-semibold">이름</th>
                <th className="px-4 py-2.5 text-left font-semibold">마지막 로그인</th>
                <th className="px-4 py-2.5 text-left font-semibold">IP</th>
                <th className="px-4 py-2.5 text-left font-semibold">가입일</th>
                <th className="px-4 py-2.5 text-center font-semibold">상태</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-black/5 last:border-0 hover:bg-black/[0.02]">
                  <td className="px-4 py-2.5 font-medium text-emerald-700">{u.loginId}</td>
                  <td className="px-4 py-2.5">{u.name || "-"}</td>
                  <td className="font-num whitespace-nowrap px-4 py-2.5 text-zinc-600">
                    {u.lastLoginAt ? ymdhm(u.lastLoginAt) : "-"}
                  </td>
                  <td className="font-num px-4 py-2.5 text-zinc-600">{u.lastLoginIp || "-"}</td>
                  <td className="font-num whitespace-nowrap px-4 py-2.5 text-zinc-500">
                    {ymdhm(u.createdAt)}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {u.leftAt ? (
                      <span className="rounded-md bg-red-100 px-2 py-0.5 text-xs text-red-600">탈퇴</span>
                    ) : u.role === "ADMIN" ? (
                      <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-xs text-white">관리자</span>
                    ) : (
                      <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">회원</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {users.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-zinc-500">로그인 기록이 없거나 검색 결과가 없습니다.</p>
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
