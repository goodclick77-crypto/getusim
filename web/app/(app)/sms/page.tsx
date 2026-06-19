import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { pt, ymdhm } from "@/lib/format";
import { rentNumber, checkSms, finishRental, cancelRental } from "./actions";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "수신대기",
  RECEIVED: "수신완료",
  FINISHED: "완료",
  CANCELED: "취소",
  EXPIRED: "만료",
};

export default async function SmsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const rentals = await prisma.numberRental.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-bold">SMS 인증</h1>

      {sp.error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {sp.error}
        </p>
      )}
      {sp.ok && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          번호가 발급되었습니다. 해당 번호로 인증 요청 후 “SMS 확인”을 눌러주세요.
        </p>
      )}

      <section className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="mb-4 font-semibold">번호 발급</h2>
        <form action={rentNumber} className="grid gap-3 sm:grid-cols-4">
          <input name="country" placeholder="국가 (예: russia)" className="rounded-lg border border-zinc-300 px-3 py-2.5" />
          <input name="product" placeholder="서비스 (예: telegram)" className="rounded-lg border border-zinc-300 px-3 py-2.5" />
          <input name="operator" placeholder="통신사 (any)" defaultValue="any" className="rounded-lg border border-zinc-300 px-3 py-2.5" />
          <button className="rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white hover:bg-emerald-500">
            번호 발급
          </button>
        </form>
        <p className="mt-2 text-xs text-zinc-400">
          발급 시 서비스 단가만큼 포인트가 차감되며, 미수신 시 취소하면 환불됩니다.
        </p>
      </section>

      <section>
        <h2 className="mb-3 font-semibold">발급 내역</h2>
        {rentals.length === 0 ? (
          <p className="text-sm text-zinc-500">발급 내역이 없습니다.</p>
        ) : (
          <ul className="space-y-2">
            {rentals.map((r) => (
              <li key={r.id} className="rounded-xl border border-zinc-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">
                      {r.service} · {r.country}
                    </p>
                    <p className="text-sm text-zinc-600">{r.phoneNumber || "발급중"}</p>
                    <p className="text-xs text-zinc-400">
                      {ymdhm(r.createdAt)} · -{pt(r.pricePoint)}
                    </p>
                  </div>
                  <span className="text-sm text-zinc-500">{STATUS_LABEL[r.status]}</span>
                </div>

                {r.smsCode && (
                  <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm">
                    인증코드: <b className="text-emerald-700">{r.smsCode}</b>
                    {r.smsText && <span className="ml-2 text-zinc-500">{r.smsText}</span>}
                  </div>
                )}

                {r.status === "PENDING" && (
                  <div className="mt-3 flex gap-2">
                    <form action={checkSms}>
                      <input type="hidden" name="id" value={r.id} />
                      <button className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-700">
                        SMS 확인
                      </button>
                    </form>
                    <form action={cancelRental}>
                      <input type="hidden" name="id" value={r.id} />
                      <button className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100">
                        취소·환불
                      </button>
                    </form>
                  </div>
                )}
                {r.status === "RECEIVED" && (
                  <form action={finishRental} className="mt-3">
                    <input type="hidden" name="id" value={r.id} />
                    <button className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100">
                      완료 처리
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
