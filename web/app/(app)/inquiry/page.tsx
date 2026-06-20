import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ymdhm } from "@/lib/format";
import { createInquiry } from "./actions";
import Reveal from "@/components/Reveal";

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
    <div className="space-y-6">
      <h1 className="flex items-center gap-2 text-xl font-bold">
        <i className="fa-solid fa-headset text-emerald-600" aria-hidden /> 1:1 문의
      </h1>

      {sp.ok && (
        <p role="status" className="glass flex items-center gap-2 rounded-2xl px-4 py-3 text-sm text-emerald-700">
          <i className="fa-solid fa-circle-check" aria-hidden /> 문의가 접수되었습니다.
        </p>
      )}

      <Reveal>
        <section className="glass rounded-2xl p-5">
          <h2 className="mb-4 font-bold">문의하기</h2>
          <form action={createInquiry} className="space-y-3">
            <input
              name="title"
              placeholder="제목"
              aria-label="제목"
              className="w-full rounded-xl border border-black/10 bg-white/60 px-3.5 py-3 outline-none focus:border-emerald-500"
            />
            <textarea
              name="content"
              placeholder="내용"
              rows={4}
              aria-label="내용"
              className="w-full rounded-xl border border-black/10 bg-white/60 px-3.5 py-3 outline-none focus:border-emerald-500"
            />
            <button className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white transition hover:bg-emerald-500">
              <i className="fa-solid fa-paper-plane" aria-hidden /> 등록
            </button>
          </form>
        </section>
      </Reveal>

      <section className="space-y-3">
        <h2 className="font-bold">문의 내역</h2>
        {inquiries.length === 0 ? (
          <p className="text-sm text-zinc-500">문의 내역이 없습니다.</p>
        ) : (
          inquiries.map((q) => (
            <article key={q.id} className="glass rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold">{q.title}</p>
                <span
                  className={
                    q.status === "ANSWERED"
                      ? "text-sm text-emerald-600"
                      : "text-sm text-amber-600"
                  }
                >
                  {q.status === "ANSWERED" ? "답변완료" : "접수"}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-600">{q.content}</p>
              <p className="font-num mt-1 text-xs text-zinc-400">{ymdhm(q.createdAt)}</p>
              {q.replies.map((rep) => (
                <div key={rep.id} className="mt-3 rounded-xl bg-emerald-50/70 p-3">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                    <i className="fa-solid fa-reply" aria-hidden /> 답변
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-700">{rep.content}</p>
                  <p className="font-num mt-1 text-xs text-zinc-400">{ymdhm(rep.createdAt)}</p>
                </div>
              ))}
            </article>
          ))
        )}
      </section>
    </div>
  );
}
