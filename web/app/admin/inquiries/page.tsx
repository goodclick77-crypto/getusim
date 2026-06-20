import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ymdhm } from "@/lib/format";
import { answerInquiry, deleteInquiry } from "../actions";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "OPEN", label: "미답변" },
  { key: "ANSWERED", label: "답변완료" },
  { key: "ALL", label: "전체" },
] as const;

export default async function AdminInquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const status = (sp.status || "OPEN").toUpperCase();
  const where =
    status === "ALL"
      ? { parentId: null }
      : { parentId: null, status: status as "OPEN" | "ANSWERED" };

  const inquiries = await prisma.inquiry.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { replies: { orderBy: { createdAt: "asc" } } },
    take: 100,
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <i className="fa-solid fa-comments text-emerald-600" aria-hidden /> 문의 관리
        </h1>
        <Link href="/admin" className="text-sm text-zinc-500 hover:text-zinc-900">
          ← 관리자 홈
        </Link>
      </div>

      <nav aria-label="상태 필터" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/inquiries?status=${t.key}`}
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

      {inquiries.length === 0 ? (
        <p className="text-sm text-zinc-500">해당 문의가 없습니다.</p>
      ) : (
        <ul className="space-y-3">
          {inquiries.map((q) => (
            <li key={q.id} className="glass rounded-2xl p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">{q.title}</p>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={
                      q.status === "ANSWERED" ? "text-sm text-emerald-600" : "text-sm text-amber-600"
                    }
                  >
                    {q.status === "ANSWERED" ? "답변완료" : "미답변"}
                  </span>
                  <form action={deleteInquiry}>
                    <input type="hidden" name="id" value={q.id} />
                    <button
                      className="rounded-lg px-2 py-1 text-red-500 hover:bg-red-50"
                      title="삭제 (스팸 등)"
                    >
                      <i className="fa-solid fa-trash" aria-hidden />
                    </button>
                  </form>
                </div>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-600">{q.content}</p>
              <p className="font-num mt-1 text-xs text-zinc-400">
                {q.name} · {ymdhm(q.createdAt)}
              </p>

              {q.replies.map((rep) => (
                <div key={rep.id} className="mt-3 rounded-xl bg-emerald-50/70 p-3">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                    <i className="fa-solid fa-reply" aria-hidden /> 답변
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-700">{rep.content}</p>
                </div>
              ))}

              <form action={answerInquiry} className="mt-3 space-y-2">
                <input type="hidden" name="parentId" value={q.id} />
                <textarea
                  name="content"
                  rows={3}
                  placeholder={
                    q.status === "ANSWERED"
                      ? "추가 답변 입력 (엔터로 줄바꿈)"
                      : "답변 입력 (엔터로 줄바꿈)"
                  }
                  aria-label="답변"
                  className="w-full rounded-xl border border-black/10 bg-white/60 px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
                />
                <div className="flex justify-end">
                  <button className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm text-white transition hover:bg-zinc-700">
                    <i className="fa-solid fa-paper-plane" aria-hidden /> 답변 등록
                  </button>
                </div>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
