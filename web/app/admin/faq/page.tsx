import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { createFaq, deleteFaq } from "./actions";
import ConfirmButton from "@/components/ConfirmButton";

export const dynamic = "force-dynamic";

export default async function AdminFaqPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const faqs = await prisma.faq.findMany({ orderBy: [{ order: "asc" }, { id: "asc" }] });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <i className="fa-solid fa-circle-question text-emerald-600" aria-hidden /> FAQ 관리
        </h1>
        <Link href="/admin" className="text-sm text-zinc-500 hover:text-zinc-900">
          ← 관리자 홈
        </Link>
      </div>

      {sp.ok && (
        <p role="status" className="glass rounded-2xl px-4 py-3 text-sm text-emerald-700">
          FAQ가 등록되었습니다.
        </p>
      )}

      <section className="glass rounded-2xl p-5">
        <h2 className="mb-4 font-bold">새 FAQ 작성</h2>
        <form action={createFaq} className="space-y-3">
          <input
            name="question"
            placeholder="질문"
            aria-label="질문"
            className="w-full rounded-xl border border-black/10 bg-white/60 px-3.5 py-3 outline-none focus:border-emerald-500"
          />
          <textarea
            name="answer"
            placeholder="답변"
            rows={4}
            aria-label="답변"
            className="w-full rounded-xl border border-black/10 bg-white/60 px-3.5 py-3 outline-none focus:border-emerald-500"
          />
          <input
            name="order"
            type="number"
            placeholder="정렬순서 (작을수록 위, 기본 0)"
            aria-label="정렬순서"
            className="w-48 rounded-xl border border-black/10 bg-white/60 px-3.5 py-3 outline-none focus:border-emerald-500"
          />
          <div>
            <button className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white transition hover:bg-emerald-500">
              <i className="fa-solid fa-plus" aria-hidden /> 등록
            </button>
          </div>
        </form>
      </section>

      <section>
        <h2 className="mb-3 font-bold">FAQ 목록 ({faqs.length})</h2>
        {faqs.length === 0 ? (
          <p className="text-sm text-zinc-500">등록된 FAQ가 없습니다.</p>
        ) : (
          <ul className="glass divide-y divide-black/5 rounded-2xl">
            {faqs.map((f) => (
              <li key={f.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span className="font-num w-8 text-center text-xs text-zinc-400">{f.order}</span>
                <span className="flex-1 truncate">{f.question}</span>
                <Link
                  href={`/admin/faq/${f.id}`}
                  className="rounded-lg px-2 py-1 text-zinc-500 hover:bg-black/5"
                  title="수정"
                >
                  <i className="fa-solid fa-pen" aria-hidden />
                </Link>
                <form action={deleteFaq}>
                  <input type="hidden" name="id" value={f.id} />
                  <ConfirmButton
                    message="이 FAQ를 삭제하시겠습니까?"
                    title="삭제"
                    className="rounded-lg px-2 py-1 text-red-500 hover:bg-red-50"
                  >
                    <i className="fa-solid fa-trash" aria-hidden />
                  </ConfirmButton>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
