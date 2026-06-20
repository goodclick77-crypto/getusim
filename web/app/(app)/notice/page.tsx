import Link from "next/link";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ymd } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function NoticePage() {
  await requireUser();
  const notices = await prisma.notice.findMany({
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    take: 100,
  });

  return (
    <div className="space-y-5">
      <h1 className="flex items-center gap-2 text-xl font-bold">
        <i className="fa-solid fa-bullhorn text-emerald-600" aria-hidden /> 공지사항
      </h1>

      {notices.length === 0 ? (
        <p className="text-sm text-zinc-500">등록된 공지가 없습니다.</p>
      ) : (
        <div className="glass overflow-hidden rounded-2xl">
          {/* 데스크톱 헤더 */}
          <div className="hidden grid-cols-[5rem_1fr_8rem_7rem_5rem] gap-2 border-b border-black/5 px-4 py-3 text-xs font-semibold text-zinc-500 sm:grid">
            <span className="text-center">구분</span>
            <span>제목</span>
            <span className="text-center">작성자</span>
            <span className="text-center">작성일</span>
            <span className="text-center">조회</span>
          </div>
          <ul className="divide-y divide-black/5">
            {notices.map((n) => (
              <li key={n.id} className={n.pinned ? "bg-emerald-50/40" : ""}>
                <Link
                  href={`/notice/${n.id}`}
                  className="grid grid-cols-[3rem_1fr] items-center gap-2 px-4 py-3.5 transition hover:bg-black/[0.03] sm:grid-cols-[5rem_1fr_8rem_7rem_5rem]"
                >
                  <span className="text-center">
                    {n.pinned ? (
                      <span className="rounded-md bg-emerald-600 px-2 py-0.5 text-xs font-bold text-white">
                        공지
                      </span>
                    ) : (
                      <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">
                        공지
                      </span>
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{n.title}</span>
                    {/* 모바일 메타 */}
                    <span className="font-num mt-0.5 block text-xs text-zinc-400 sm:hidden">
                      {n.authorName} · {ymd(n.createdAt)} · 조회 {n.views}
                    </span>
                  </span>
                  <span className="hidden text-center text-sm text-zinc-600 sm:block">
                    {n.authorName}
                  </span>
                  <span className="font-num hidden text-center text-sm text-zinc-500 sm:block">
                    {ymd(n.createdAt)}
                  </span>
                  <span className="font-num hidden text-center text-sm text-zinc-500 sm:block">
                    {n.views}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
