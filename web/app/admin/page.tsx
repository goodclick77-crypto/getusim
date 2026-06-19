import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { won, pt, ymdhm } from "@/lib/format";
import { confirmCharge, cancelCharge, answerInquiry } from "./actions";

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
    <div className="space-y-10">
      <section className="grid grid-cols-3 gap-3">
        <Stat label="총 회원" value={userCount.toLocaleString("ko-KR")} />
        <Stat label="발행 포인트" value={pt(pointSum._sum.point ?? 0)} />
        <Stat label="입금대기" value={`${pendingCharges.length}건`} />
      </section>

      <section>
        <h2 className="mb-3 font-semibold">입금 확인 대기</h2>
        {pendingCharges.length === 0 ? (
          <p className="text-sm text-zinc-500">대기 중인 충전 신청이 없습니다.</p>
        ) : (
          <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white">
            {pendingCharges.map((o) => (
              <li key={o.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <p>
                    {o.user.name || o.user.loginId} · 입금자 <b>{o.depositName}</b>
                  </p>
                  <p className="text-xs text-zinc-400">
                    {won(o.amount)} → {pt(o.chargePoint)} · {ymdhm(o.createdAt)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <form action={confirmCharge}>
                    <input type="hidden" name="id" value={o.id} />
                    <button className="rounded-lg bg-emerald-600 px-3 py-1.5 text-white hover:bg-emerald-500">
                      입금확인·지급
                    </button>
                  </form>
                  <form action={cancelCharge}>
                    <input type="hidden" name="id" value={o.id} />
                    <button className="rounded-lg border border-zinc-300 px-3 py-1.5 hover:bg-zinc-100">
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
        <h2 className="font-semibold">미답변 문의</h2>
        {openInquiries.length === 0 ? (
          <p className="text-sm text-zinc-500">미답변 문의가 없습니다.</p>
        ) : (
          openInquiries.map((q) => (
            <div key={q.id} className="rounded-xl border border-zinc-200 bg-white p-4">
              <p className="font-medium">{q.title}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-600">{q.content}</p>
              <p className="mt-1 text-xs text-zinc-400">
                {q.name} · {ymdhm(q.createdAt)}
              </p>
              <form action={answerInquiry} className="mt-3 flex gap-2">
                <input type="hidden" name="parentId" value={q.id} />
                <input name="content" placeholder="답변 입력" className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
                <button className="rounded-lg bg-zinc-900 px-3 py-2 text-sm text-white hover:bg-zinc-700">
                  답변
                </button>
              </form>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}
