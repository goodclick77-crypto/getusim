import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ymd } from "@/lib/format";
import { createNotice, deleteNotice, togglePin } from "./actions";
import ConfirmButton from "@/components/ConfirmButton";

export const dynamic = "force-dynamic";

export default async function AdminNoticePage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const notices = await prisma.notice.findMany({
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    take: 100,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <i className="fa-solid fa-bullhorn text-emerald-600" aria-hidden /> 공지 관리
        </h1>
        <Link href="/admin" className="text-sm text-zinc-500 hover:text-zinc-900">
          ← 관리자 홈
        </Link>
      </div>

      {sp.ok && (
        <p role="status" className="glass rounded-2xl px-4 py-3 text-sm text-emerald-700">
          공지가 등록되었습니다.
        </p>
      )}

      <section className="glass rounded-2xl p-5">
        <h2 className="mb-4 font-bold">새 공지 작성</h2>
        <form action={createNotice} className="space-y-3">
          <input
            name="title"
            placeholder="제목"
            aria-label="제목"
            className="w-full rounded-xl border border-black/10 bg-white/60 px-3.5 py-3 outline-none focus:border-emerald-500"
          />
          <textarea
            name="content"
            placeholder="내용"
            rows={5}
            aria-label="내용"
            className="w-full rounded-xl border border-black/10 bg-white/60 px-3.5 py-3 outline-none focus:border-emerald-500"
          />
          <label className="flex items-center gap-2 text-sm text-zinc-600">
            <input type="checkbox" name="pinned" /> 상단 고정(공지)
          </label>
          <button className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white transition hover:bg-emerald-500">
            <i className="fa-solid fa-plus" aria-hidden /> 등록
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 font-bold">공지 목록 ({notices.length})</h2>
        <ul className="glass divide-y divide-black/5 rounded-2xl">
          {notices.map((n) => (
            <li key={n.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              {n.pinned && (
                <span className="rounded-md bg-emerald-600/10 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                  고정
                </span>
              )}
              <Link href={`/notice/${n.id}`} className="flex-1 truncate hover:underline">
                {n.title}
              </Link>
              <span className="font-num text-xs text-zinc-400">{ymd(n.createdAt)}</span>
              <Link
                href={`/admin/notice/${n.id}`}
                className="rounded-lg px-2 py-1 text-zinc-500 hover:bg-black/5"
                title="수정"
              >
                <i className="fa-solid fa-pen" aria-hidden />
              </Link>
              <form action={togglePin}>
                <input type="hidden" name="id" value={n.id} />
                <button
                  className="rounded-lg px-2 py-1 text-zinc-500 hover:bg-black/5"
                  title={n.pinned ? "고정 해제" : "상단 고정"}
                >
                  <i className={`fa-${n.pinned ? "solid" : "regular"} fa-thumbtack`} aria-hidden />
                </button>
              </form>
              <form action={deleteNotice}>
                <input type="hidden" name="id" value={n.id} />
                <ConfirmButton
                  message="이 공지를 삭제하시겠습니까?"
                  title="삭제"
                  className="rounded-lg px-2 py-1 text-red-500 hover:bg-red-50"
                >
                  <i className="fa-solid fa-trash" aria-hidden />
                </ConfirmButton>
              </form>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
