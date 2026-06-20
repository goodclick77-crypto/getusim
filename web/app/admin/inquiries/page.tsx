import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ymdhm } from "@/lib/format";
import { answerInquiry } from "../actions";

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
                <span
                  className={
                    q.status === "ANSWERED"
                      ? "shrink-0 text-sm text-emerald-600"
                      : "shrink-0 text-sm text-amber-600"
                  }
                >
                  {q.status === "ANSWERED" ? "답변완료" : "미답변"}
                </span>
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

              <form action={answerInquiry} className="mt-3 flex gap-2">
                <input type="hidden" name="parentId" value={q.id} />
                <input
                  name="content"
                  placeholder={q.status === "ANSWERED" ? "추가 답변 입력" : "답변 입력"}
                  aria-label="답변"
                  className="flex-1 rounded-xl border border-black/10 bg-white/60 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                />
                <button className="rounded-xl bg-zinc-900 px-4 py-2 text-sm text-white transition hover:bg-zinc-700">
                  답변
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
