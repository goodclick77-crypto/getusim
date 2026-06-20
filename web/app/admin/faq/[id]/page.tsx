import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { updateFaq } from "../actions";

export const dynamic = "force-dynamic";

export default async function EditFaqPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const faq = await prisma.faq.findUnique({ where: { id: Number(id) } });
  if (!faq) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <i className="fa-solid fa-pen text-emerald-600" aria-hidden /> FAQ 수정
        </h1>
        <Link href="/admin/faq" className="text-sm text-zinc-500 hover:text-zinc-900">
          ← FAQ 관리
        </Link>
      </div>

      <section className="glass rounded-2xl p-5">
        <form action={updateFaq} className="space-y-3">
          <input type="hidden" name="id" value={faq.id} />
          <input
            name="question"
            defaultValue={faq.question}
            placeholder="질문"
            aria-label="질문"
            className="w-full rounded-xl border border-black/10 bg-white/60 px-3.5 py-3 outline-none focus:border-emerald-500"
          />
          <textarea
            name="answer"
            defaultValue={faq.answer}
            rows={6}
            placeholder="답변"
            aria-label="답변"
            className="w-full rounded-xl border border-black/10 bg-white/60 px-3.5 py-3 outline-none focus:border-emerald-500"
          />
          <input
            name="order"
            type="number"
            defaultValue={faq.order}
            placeholder="정렬순서 (작을수록 위)"
            aria-label="정렬순서"
            className="w-48 rounded-xl border border-black/10 bg-white/60 px-3.5 py-3 outline-none focus:border-emerald-500"
          />
          <div className="flex gap-2">
            <button className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white transition hover:bg-emerald-500">
              <i className="fa-solid fa-floppy-disk" aria-hidden /> 저장
            </button>
            <Link
              href="/admin/faq"
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
