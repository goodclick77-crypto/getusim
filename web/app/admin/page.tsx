import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { won, pt, ymdhm } from "@/lib/format";
import { confirmCharge, cancelCharge, answerInquiry } from "./actions";
import Tilt from "@/components/Tilt";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdmin();
  const [pendingCharges, openInquiries, userCount, pointSum] = await Promise.all([
    prisma.chargeOrder.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { loginId: true, name: true } } },
      take: 50,
    }),
    prisma.inquiry.findMany({
      where: { parentId: null, status: "OPEN" },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.user.count(),
    prisma.user.aggregate({ _sum: { point: true } }),
  ]);

  return (
    <div className="space-y-8">
      <nav aria-label="관리 메뉴" className="flex flex-wrap gap-2">
        <Link
          href="/admin/notice"
          className="glass inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium hover:bg-white/70"
        >
          <i className="fa-solid fa-bullhorn text-emerald-600" aria-hidden /> 공지 관리
        </Link>
        <Link
          href="/admin/faq"
          className="glass inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium hover:bg-white/70"
        >
          <i className="fa-solid fa-circle-question text-emerald-600" aria-hidden /> FAQ 관리
        </Link>
      </nav>

      <section aria-label="통계" className="grid grid-cols-3 gap-3">
        <Stat icon="fa-users" label="총 회원" value={userCount.toLocaleString("ko-KR")} />
        <Stat icon="fa-coins" label="발행 포인트" value={pt(pointSum._sum.point ?? 0)} />
        <Stat icon="fa-hourglass-half" label="입금대기" value={`${pendingCharges.length}건`} />
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 font-bold">
          <i className="fa-solid fa-building-columns text-emerald-600" aria-hidden /> 입금 확인 대기
        </h2>
        {pendingCharges.length === 0 ? (
          <p className="text-sm text-zinc-500">대기 중인 충전 신청이 없습니다.</p>
        ) : (
          <ul className="glass divide-y divide-black/5 rounded-2xl">
            {pendingCharges.map((o) => (
              <li key={o.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <p>
                    {o.user.name || o.user.loginId} · 입금자 <b>{o.depositName}</b>
                  </p>
                  <p className="font-num text-xs text-zinc-400">
                    {won(o.amount)} → {pt(o.chargePoint)} · {ymdhm(o.createdAt)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <form action={confirmCharge}>
                    <input type="hidden" name="id" value={o.id} />
                    <button className="rounded-lg bg-emerald-600 px-3 py-1.5 text-white transition hover:bg-emerald-500">
                      입금확인·지급
                    </button>
                  </form>
                  <form action={cancelCharge}>
                    <input type="hidden" name="id" value={o.id} />
                    <button className="rounded-lg border border-black/10 px-3 py-1.5 hover:bg-black/5">
                      취소
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 font-bold">
          <i className="fa-solid fa-comments text-emerald-600" aria-hidden /> 미답변 문의
        </h2>
        {openInquiries.length === 0 ? (
          <p className="text-sm text-zinc-500">미답변 문의가 없습니다.</p>
        ) : (
          openInquiries.map((q) => (
            <article key={q.id} className="glass rounded-2xl p-4">
              <p className="font-semibold">{q.title}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-600">{q.content}</p>
              <p className="font-num mt-1 text-xs text-zinc-400">
                {q.name} · {ymdhm(q.createdAt)}
              </p>
              <form action={answerInquiry} className="mt-3 flex gap-2">
                <input type="hidden" name="parentId" value={q.id} />
                <input
                  name="content"
                  placeholder="답변 입력"
                  aria-label="답변"
                  className="flex-1 rounded-xl border border-black/10 bg-white/60 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                />
                <button className="rounded-xl bg-zinc-900 px-3 py-2 text-sm text-white transition hover:bg-zinc-700">
                  답변
                </button>
              </form>
            </article>
          ))
        )}
      </section>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <Tilt>
      <div className="glass rounded-2xl p-4">
        <p className="flex items-center gap-2 text-xs text-zinc-500">
          <i className={`fa-solid ${icon} text-emerald-600`} aria-hidden /> {label}
        </p>
        <p className="font-num mt-1 text-lg font-bold">{value}</p>
      </div>
    </Tilt>
  );
}
