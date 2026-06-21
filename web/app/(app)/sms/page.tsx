import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { pt, ymdhm, phoneFmt } from "@/lib/format";
import { expireStaleRentals } from "@/lib/rentals";
import NumberAuth from "./NumberAuth";
import RentalLabel from "@/components/RentalLabel";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "수신대기",
  RECEIVED: "수신완료",
  FINISHED: "완료",
  CANCELED: "밴/취소",
  EXPIRED: "만료",
};
const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  RECEIVED: "bg-emerald-100 text-emerald-700",
  FINISHED: "bg-zinc-200 text-zinc-500",
  CANCELED: "bg-zinc-200 text-zinc-500",
  EXPIRED: "bg-zinc-200 text-zinc-500",
};

export default async function SmsPage() {
  const user = await requireUser();
  await expireStaleRentals(); // 지난 수신대기건 만료 처리
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
              <li key={r.id} className="px-4 py-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <RentalLabel country={r.country} service={r.service} />
                  </div>
                  <span
                    className={`shrink-0 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[r.status] ?? "bg-zinc-200 text-zinc-500"}`}
                  >
                    {STATUS_LABEL[r.status] ?? r.status}
                  </span>
                </div>
                <p className="font-num mt-1 text-xs text-zinc-400">
                  {r.phoneNumber ? phoneFmt(r.phoneNumber) : "-"} · {ymdhm(r.createdAt)}
                  {r.smsCode ? ` · 코드 ${r.smsCode} · -${pt(r.pricePoint)}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
