import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ymdhm, pt } from "@/lib/format";
import InquiryForm from "./InquiryForm";
import Reveal from "@/components/Reveal";

const ERRORS: Record<string, string> = {
  empty: "제목과 내용을 입력하세요.",
  refund: "환불 포인트(1 이상)와 환불 정보를 입력하세요.",
  refund_over: "환불 포인트가 보유 포인트보다 큽니다.",
};

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
      {sp.error && ERRORS[sp.error] && (
        <p role="alert" className="glass flex items-center gap-2 rounded-2xl px-4 py-3 text-sm text-red-600">
          <i className="fa-solid fa-circle-exclamation" aria-hidden /> {ERRORS[sp.error]}
        </p>
      )}

      <Reveal>
        <section className="glass rounded-2xl p-5">
          <h2 className="mb-4 font-bold">문의하기</h2>
          <InquiryForm currentPoint={user.point} />
        </section>
      </Reveal>

      <section className="space-y-3">
        <h2 className="font-bold">문의 내역</h2>
        {inquiries.length === 0 ? (
          <p className="text-sm text-zinc-500">문의 내역이 없습니다.</p>
        ) : (
          inquiries.map((q) => (
            <article key={q.id} className="glass rounded-2xl p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-2 font-semibold">
                  {q.category === "REFUND" && (
                    <span className="shrink-0 rounded-md bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                      환불
                    </span>
                  )}
                  {q.title}
                </p>
                <span
                  className={
                    q.status === "ANSWERED"
                      ? "shrink-0 text-sm text-emerald-600"
                      : "shrink-0 text-sm text-amber-600"
                  }
                >
                  {q.status === "ANSWERED" ? "답변완료" : "접수"}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-600">{q.content}</p>
              {q.category === "REFUND" && (
                <p className="mt-2 text-xs text-zinc-500">
                  환불 신청 {pt(q.refundPoint ?? 0)}
                  {q.refundedAt ? (
                    <span className="ml-1 font-medium text-emerald-600">· 환불 완료(차감됨)</span>
                  ) : (
                    <span className="ml-1 text-amber-600">· 처리 대기</span>
                  )}
                </p>
              )}
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
