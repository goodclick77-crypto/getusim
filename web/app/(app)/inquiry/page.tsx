import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ymdhm } from "@/lib/format";
import { createInquiry } from "./actions";

export const dynamic = "force-dynamic";

export default async function InquiryPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const inquiries = await prisma.inquiry.findMany({
    where: { userId: user.id, parentId: null },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { replies: { orderBy: { createdAt: "asc" } } },
  });

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-bold">1:1 문의</h1>

      {sp.ok && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          문의가 접수되었습니다.
        </p>
      )}

      <section className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="mb-4 font-semibold">문의하기</h2>
        <form action={createInquiry} className="space-y-3">
          <input name="title" placeholder="제목" className="w-full rounded-lg border border-zinc-300 px-3 py-2.5" />
          <textarea name="content" placeholder="내용" rows={4} className="w-full rounded-lg border border-zinc-300 px-3 py-2.5" />
          <button className="rounded-lg bg-emerald-600 px-5 py-2.5 font-medium text-white hover:bg-emerald-500">
            등록
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">문의 내역</h2>
        {inquiries.length === 0 ? (
          <p className="text-sm text-zinc-500">문의 내역이 없습니다.</p>
        ) : (
          inquiries.map((q) => (
            <div key={q.id} className="rounded-xl border border-zinc-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <p className="font-medium">{q.title}</p>
                <span className={q.status === "ANSWERED" ? "text-emerald-600 text-sm" : "text-amber-600 text-sm"}>
                  {q.status === "ANSWERED" ? "답변완료" : "접수"}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-600">{q.content}</p>
              <p className="mt-1 text-xs text-zinc-400">{ymdhm(q.createdAt)}</p>
              {q.replies.map((rep) => (
                <div key={rep.id} className="mt-3 rounded-lg bg-zinc-50 p-3">
                  <p className="text-xs font-medium text-emerald-700">답변</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-700">{rep.content}</p>
                  <p className="mt-1 text-xs text-zinc-400">{ymdhm(rep.createdAt)}</p>
                </div>
              ))}
            </div>
          ))
        )}
      </section>
    </div>
  );
}
