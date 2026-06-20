import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { pt, ymdhm, phoneFmt } from "@/lib/format";
import NumberAuth from "./NumberAuth";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "수신대기",
  RECEIVED: "수신완료",
  FINISHED: "완료",
  CANCELED: "밴/취소",
  EXPIRED: "만료",
};

export default async function SmsPage() {
  const user = await requireUser();
  const rentals = await prisma.numberRental.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <div className="space-y-6">
      <h1 className="flex items-center gap-2 text-xl font-bold">
        <i className="fa-solid fa-comment-sms text-emerald-600" aria-hidden /> 해외 SMS 인증
      </h1>

      <NumberAuth initialPoint={user.point} isAdmin={user.role === "ADMIN"} />

      <section>
        <h2 className="mb-3 flex items-center gap-2 font-bold">
          <i className="fa-solid fa-clock-rotate-left text-emerald-600" aria-hidden /> 발급 내역
        </h2>
        {rentals.length === 0 ? (
          <p className="text-sm text-zinc-500">발급 내역이 없습니다.</p>
        ) : (
          <ul className="glass divide-y divide-black/5 rounded-2xl">
            {rentals.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {r.service} · {r.country}{" "}
                    <span className="font-num text-zinc-600">{phoneFmt(r.phoneNumber)}</span>
                  </p>
                  <p className="font-num text-xs text-zinc-400">
                    {ymdhm(r.createdAt)}
                    {r.smsCode ? ` · 코드 ${r.smsCode} · -${pt(r.pricePoint)}` : ""}
                  </p>
                </div>
                <span
                  className={
                    r.status === "RECEIVED"
                      ? "text-emerald-600"
                      : r.status === "PENDING"
                        ? "text-amber-600"
                        : "text-zinc-400"
                  }
                >
                  {STATUS_LABEL[r.status]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
