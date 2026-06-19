import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { won, pt, ymdhm } from "@/lib/format";
import { CHARGE_PACKAGES, BANK_INFO } from "@/lib/config";
import { createChargeRequest } from "./actions";

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
    <div className="space-y-8">
      <h1 className="text-xl font-bold">포인트 충전</h1>

      {sp.ok && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          충전 신청이 접수되었습니다. 아래 계좌로 입금해 주시면 확인 후 포인트가
          지급됩니다.
        </p>
      )}

      <section className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="font-semibold">무통장 입금 계좌</h2>
        <p className="mt-2 text-sm text-zinc-600">
          {BANK_INFO.bank} <b>{BANK_INFO.account}</b> (예금주 {BANK_INFO.holder})
        </p>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="mb-4 font-semibold">충전 신청</h2>
        <form action={createChargeRequest} className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {CHARGE_PACKAGES.map((p, i) => (
              <label
                key={i}
                className="cursor-pointer rounded-lg border border-zinc-300 p-3 text-center text-sm has-checked:border-emerald-500 has-checked:bg-emerald-50"
              >
                <input
                  type="radio"
                  name="package"
                  value={i}
                  defaultChecked={i === 0}
                  className="sr-only"
                />
                <div className="font-semibold">{won(p.price)}</div>
                <div className="text-xs text-emerald-600">{pt(p.point)}</div>
              </label>
            ))}
          </div>
          <input
            name="depositName"
            placeholder="입금자명"
            defaultValue={user.name}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2.5"
          />
          <button className="rounded-lg bg-emerald-600 px-5 py-2.5 font-medium text-white hover:bg-emerald-500">
            충전 신청
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 font-semibold">충전 내역</h2>
        {orders.length === 0 ? (
          <p className="text-sm text-zinc-500">충전 내역이 없습니다.</p>
        ) : (
          <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white">
            {orders.map((o) => (
              <li key={o.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <p>
                    {won(o.amount)} → {pt(o.chargePoint)}
                  </p>
                  <p className="text-xs text-zinc-400">{ymdhm(o.createdAt)}</p>
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
