import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ymdhm } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function NoticeDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const noticeId = Number(id);
  if (!noticeId) notFound();

  const notice = await prisma.notice
    .update({ where: { id: noticeId }, data: { views: { increment: 1 } } })
    .catch(() => null);
  if (!notice) notFound();

  return (
    <article className="space-y-5">
      <Link
        href="/notice"
        className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900"
      >
        <i className="fa-solid fa-chevron-left" aria-hidden /> 목록
      </Link>

      <header className="glass rounded-2xl p-6">
        <div className="flex items-center gap-2">
          {notice.pinned && (
            <span className="rounded-md bg-emerald-600/10 px-2 py-0.5 text-xs font-semibold text-emerald-700">
              공지
            </span>
          )}
          <h1 className="text-xl font-bold">{notice.title}</h1>
        </div>
        <p className="font-num mt-2 text-xs text-zinc-400">
          {notice.authorName} · {ymdhm(notice.createdAt)} · 조회 {notice.views}
        </p>
      </header>

      <div className="glass whitespace-pre-wrap rounded-2xl p-6 leading-relaxed text-zinc-700">
        {notice.content || "(내용 없음)"}
      </div>
    </article>
  );
}
