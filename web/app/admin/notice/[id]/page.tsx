import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { updateNotice } from "../actions";

export const dynamic = "force-dynamic";

export default async function EditNoticePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const notice = await prisma.notice.findUnique({ where: { id: Number(id) } });
  if (!notice) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <i className="fa-solid fa-pen text-emerald-600" aria-hidden /> 공지 수정
        </h1>
        <Link href="/admin/notice" className="text-sm text-zinc-500 hover:text-zinc-900">
          ← 공지 관리
        </Link>
      </div>

      <section className="glass rounded-2xl p-5">
        <form action={updateNotice} className="space-y-3">
          <input type="hidden" name="id" value={notice.id} />
          <input
            name="title"
            defaultValue={notice.title}
            placeholder="제목"
            aria-label="제목"
            className="w-full rounded-xl border border-black/10 bg-white/60 px-3.5 py-3 outline-none focus:border-emerald-500"
          />
          <textarea
            name="content"
            defaultValue={notice.content}
            rows={8}
            placeholder="내용"
            aria-label="내용"
            className="w-full rounded-xl border border-black/10 bg-white/60 px-3.5 py-3 outline-none focus:border-emerald-500"
          />
          <label className="flex items-center gap-2 text-sm text-zinc-600">
            <input type="checkbox" name="pinned" defaultChecked={notice.pinned} /> 상단 고정(공지)
          </label>
          <div className="flex gap-2">
            <button className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white transition hover:bg-emerald-500">
              <i className="fa-solid fa-floppy-disk" aria-hidden /> 저장
            </button>
            <Link
              href="/admin/notice"
              className="inline-flex items-center rounded-xl border border-black/10 px-5 py-3 text-zinc-600 hover:bg-black/5"
            >
              취소
            </Link>
          </div>
        </form>
      </section>
    </div>
  );
}
