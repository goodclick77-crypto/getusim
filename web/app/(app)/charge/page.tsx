import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { won, pt, ymdhm } from "@/lib/format";
import { CHARGE_PACKAGES, BANK_INFO } from "@/lib/config";
import { createChargeRequest } from "./actions";
import Reveal from "@/components/Reveal";
import CopyButton from "@/components/CopyButton";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "입금대기",
  COMPLETED: "충전완료",
  CANCELED: "취소",
};

export default async function ChargePage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const orders = await prisma.chargeOrder.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <div className="space-y-6">
      <h1 className="flex items-center gap-2 text-xl font-bold">
        <i className="fa-solid fa-coins text-emerald-600" aria-hidden /> 포인트 충전
      </h1>

      {sp.ok && (
        <p role="status" className="glass flex items-center gap-2 rounded-2xl px-4 py-3 text-sm text-emerald-700">
          <i className="fa-solid fa-circle-check" aria-hidden /> 충전 신청이 접수되었습니다. 아래
          계좌로 입금해 주시면 확인 후 포인트가 지급됩니다.
        </p>
      )}

      <Reveal>
        <section className="glass rounded-2xl p-5">
          <h2 className="flex items-center gap-2 font-bold">
            <i className="fa-solid fa-building-columns text-zinc-500" aria-hidden /> 무통장 입금 계좌
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-zinc-700">
            <span>{BANK_INFO.bank}</span>
            <b className="font-num text-base">{BANK_INFO.account}</b>
            <span className="text-zinc-500">예금주 {BANK_INFO.holder}</span>
            <CopyButton
              text={BANK_INFO.account.replace(/[^\d]/g, "")}
              label="계좌복사"
              className="border border-black/10"
            />
          </div>
        </section>
      </Reveal>

      <Reveal delay={80}>
        <section className="glass rounded-2xl p-5">
          <h2 className="mb-4 font-bold">충전 신청</h2>
          <form action={createChargeRequest} className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {CHARGE_PACKAGES.map((p, i) => (
                <label
                  key={i}
                  className="cursor-pointer rounded-2xl border border-black/10 bg-white/50 p-3 text-center text-sm transition has-checked:border-emerald-500 has-checked:bg-emerald-50"
                >
                  <input
                    type="radio"
                    name="package"
                    value={i}
                    defaultChecked={i === 0}
                    className="sr-only"
                  />
                  <div className="font-num font-bold">{won(p.price)}</div>
                  <div className="font-num text-xs text-emerald-600">{pt(p.point)}</div>
                </label>
              ))}
            </div>
            <div>
              <input
                name="depositName"
                placeholder="입금자명"
                defaultValue={user.name}
                aria-label="입금자명"
                className="w-full rounded-xl border border-black/10 bg-white/60 px-3.5 py-3 outline-none focus:border-emerald-500"
              />
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-zinc-500">
                <i className="fa-solid fa-circle-info" aria-hidden />
                실제 입금하실 분의 이름과 <b>똑같이</b> 입력하세요. 선택한 금액 그대로 입금하시면
                자동으로 충전됩니다.
              </p>
            </div>
            <button className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white transition hover:bg-emerald-500">
              <i className="fa-solid fa-paper-plane" aria-hidden /> 충전 신청
            </button>
          </form>
        </section>
      </Reveal>

      <section>
        <h2 className="mb-3 font-bold">충전 내역</h2>
        {orders.length === 0 ? (
          <p className="text-sm text-zinc-500">충전 내역이 없습니다.</p>
        ) : (
          <ul className="glass divide-y divide-black/5 rounded-2xl">
            {orders.map((o) => (
              <li key={o.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <p className="font-num">
                    {won(o.amount)} → {pt(o.chargePoint)}
                  </p>
                  <p className="font-num text-xs text-zinc-400">{ymdhm(o.createdAt)}</p>
                </div>
                <span
                  className={
                    o.status === "COMPLETED"
                      ? "text-emerald-600"
                      : o.status === "CANCELED"
                        ? "text-red-500"
                        : "text-amber-600"
                  }
                >
                  {STATUS_LABEL[o.status]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
