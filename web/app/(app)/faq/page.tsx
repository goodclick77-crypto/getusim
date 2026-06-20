import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function FaqPage() {
  await requireUser();
  const faqs = await prisma.faq.findMany({
    orderBy: [{ order: "asc" }, { id: "asc" }],
  });

  return (
    <div className="space-y-5">
      <h1 className="flex items-center gap-2 text-xl font-bold">
        <i className="fa-solid fa-circle-question text-emerald-600" aria-hidden /> 자주 묻는 질문
      </h1>

      {faqs.length === 0 ? (
        <p className="text-sm text-zinc-500">등록된 FAQ가 없습니다.</p>
      ) : (
        <ul className="space-y-2">
          {faqs.map((f) => (
            <li key={f.id} className="glass overflow-hidden rounded-2xl">
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 font-medium [&::-webkit-details-marker]:hidden">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-emerald-600/10 text-sm font-bold text-emerald-600">
                    Q
                  </span>
                  <span className="flex-1">{f.question}</span>
                  <i
                    className="fa-solid fa-chevron-down text-zinc-400 transition-transform group-open:rotate-180"
                    aria-hidden
                  />
                </summary>
                <div className="border-t border-black/5 px-5 py-4">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-600">
                    {f.answer}
                  </p>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
