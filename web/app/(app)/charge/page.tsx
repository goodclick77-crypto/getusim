import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { won, pt, ymdhm } from "@/lib/format";
import { BANK_INFO, CHARGE_POINT_UNITS, CHARGE_FEE_RATE } from "@/lib/config";
import { createChargeRequest } from "./actions";
import ChargeForm from "./ChargeForm";
import Reveal from "@/components/Reveal";
import CopyButton from "@/components/CopyButton";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "입금대기",
  COMPLETED: "충전완료",
  CANCELED: "취소",
};
const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  CANCELED: "bg-zinc-200 text-zinc-500",
};

export default async function ChargePage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const [orders, refunds] = await Promise.all([
    prisma.chargeOrder.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.pointLog.findMany({
      where: { userId: user.id, relType: "refund" },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  // 충전(ChargeOrder)과 환불(PointLog)을 한 내역으로 병합(날짜순)
  type Item =
    | { kind: "charge"; id: number; createdAt: Date; chargePoint: number; amount: number; status: string }
    | { kind: "refund"; id: number; createdAt: Date; amount: number };
  const items: Item[] = [
    ...orders.map((o) => ({
      kind: "charge" as const,
      id: o.id,
      createdAt: o.createdAt,
      chargePoint: o.chargePoint,
      amount: o.amount,
      status: o.status,
    })),
    ...refunds.map((r) => ({
      kind: "refund" as const,
      id: r.id,
      createdAt: r.createdAt,
      amount: r.amount,
    })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 20);

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
            <i className="fa-solid fa-building-columns text-emerald-600" aria-hidden /> 무통장 입금 계좌
          </h2>
          <dl className="mt-3 overflow-hidden rounded-xl border border-black/10">
            <div className="flex items-center justify-between gap-3 border-b border-black/5 px-4 py-3 text-sm">
              <dt className="text-zinc-500">은행</dt>
              <dd className="font-medium">{BANK_INFO.bank}</dd>
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-black/5 bg-emerald-50/40 px-4 py-3">
              <dt className="text-sm text-zinc-500">계좌번호</dt>
              <dd className="flex items-center gap-2">
                <b className="font-num text-base tracking-tight sm:text-lg">{BANK_INFO.account}</b>
                <CopyButton
                  text={BANK_INFO.account.replace(/[^\d]/g, "")}
                  label="복사"
                  className="border border-black/10"
                />
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <dt className="text-zinc-500">예금주</dt>
              <dd className="font-medium">{BANK_INFO.holder}</dd>
            </div>
          </dl>
        </section>
      </Reveal>

      <Reveal delay={80}>
        <section className="glass rounded-2xl p-5">
          <h2 className="mb-1 font-bold">충전 신청</h2>
          <p className="mb-4 text-xs text-zinc-500">
            원하는 금액 단위를 눌러 더하세요. (예: 1만P 두 번 = 2만P)
          </p>
          <ChargeForm
            action={createChargeRequest}
            units={CHARGE_POINT_UNITS}
            feeRate={CHARGE_FEE_RATE}
            defaultName={user.name}
          />
        </section>
      </Reveal>

      <section>
        <h2 className="mb-3 font-bold">충전·환불 내역</h2>
        {items.length === 0 ? (
          <p className="text-sm text-zinc-500">내역이 없습니다.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((it) =>
              it.kind === "charge" ? (
                <li key={`c-${it.id}`} className="glass flex items-center gap-3 rounded-2xl p-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-num text-base font-bold">
                      {pt(it.chargePoint)}{" "}
                      <span className="text-sm font-normal text-zinc-400">충전</span>
                    </p>
                    <p className="font-num mt-0.5 text-xs text-zinc-400">
                      입금액 {won(it.amount)} · {ymdhm(it.createdAt)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[it.status]}`}
                  >
                    {STATUS_LABEL[it.status]}
                  </span>
                </li>
              ) : (
                <li key={`r-${it.id}`} className="glass flex items-center gap-3 rounded-2xl p-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-num text-base font-bold text-red-500">
                      {pt(it.amount)}{" "}
                      <span className="text-sm font-normal text-zinc-400">환불</span>
                    </p>
                    <p className="font-num mt-0.5 text-xs text-zinc-400">{ymdhm(it.createdAt)}</p>
                  </div>
                  <span className="shrink-0 rounded-md bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                    환불
                  </span>
                </li>
              ),
            )}
          </ul>
        )}
      </section>
    </div>
  );
}
