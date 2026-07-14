import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { won, pt, ymd, ymdhm, dateRange } from "@/lib/format";
import {
  confirmCharge,
  cancelCharge,
  restoreCharge,
  matchDeposit,
  dismissDeposit,
  deleteDeposit,
} from "../actions";
import ConfirmButton from "@/components/ConfirmButton";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "PENDING", label: "입금대기" },
  { key: "COMPLETED", label: "충전완료" },
  { key: "CANCELED", label: "취소" },
  { key: "ALL", label: "전체" },
] as const;

const STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  CANCELED: "bg-zinc-200 text-zinc-500",
};
const STATUS_LABEL: Record<string, string> = {
  PENDING: "입금대기",
  COMPLETED: "충전완료",
  CANCELED: "취소",
};

const PER = 60;
/** 미매칭 입금에 수동 연결할 주문 후보를 찾는 기간(일).
 * 금액만으로 후보를 잡으므로 기간이 길수록 남의 주문이 대거 섞여 오선택 위험이 커진다.
 * 입금은 보통 신청 당일~며칠 내에 들어오므로 짧게 잡는다. */
const DEPOSIT_MATCH_WINDOW_DAYS = 7;

export default async function AdminChargesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string; from?: string; to?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const status = (sp.status || "PENDING").toUpperCase();
  const q = (sp.q || "").trim();
  const from = (sp.from || "").trim();
  const to = (sp.to || "").trim();
  const page = Math.max(1, Number(sp.page) || 1);
  const createdAt = dateRange(from, to);
  const carry = `${q ? `&q=${encodeURIComponent(q)}` : ""}${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}`;

  const where = {
    // 검색(q) 중에는 상태 탭에 상관없이 전체에서 찾는다(완료/취소 입금도 검색되도록)
    ...(status === "ALL" || q
      ? {}
      : { status: status as "PENDING" | "COMPLETED" | "CANCELED" }),
    ...(createdAt ? { createdAt } : {}),
    ...(q
      ? {
          OR: [
            { depositName: { contains: q, mode: "insensitive" as const } },
            { user: { loginId: { contains: q, mode: "insensitive" as const } } },
            { user: { name: { contains: q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const since = new Date(Date.now() - DEPOSIT_MATCH_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const [orders, count, unmatchedDeposits, recentMatched, unmatchedCount, matchCandidates] =
    await Promise.all([
    prisma.chargeOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { loginId: true, name: true } } },
      skip: (page - 1) * PER,
      take: PER,
    }),
    prisma.chargeOrder.count({ where }),
    // 미매칭 입금은 오래된 것도 반드시 다 보이도록 전부 로드(최근순, 안전상한 100)
    prisma.depositLog.findMany({
      where: { matched: false },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    // 최근 처리(매칭)된 입금도 참고용으로 일부 표시
    prisma.depositLog.findMany({
      where: { matched: true },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    // 실제 미매칭(금액 있는 실입금) 총 건수 — 배지 표시용(목록 상한과 무관)
    prisma.depositLog.count({ where: { matched: false, amount: { gt: 0 } } }),
    // 미매칭 입금을 수동 연결할 후보 = 아직 지급 안 된 입금대기 주문만.
    // 완료 주문은 넣지 않는다: 수동 지급 시 completeCharge 가 미매칭 입금로그를
    // 이미 자동 연결하므로(lib/charge.ts) 중복이고, 이미 지급된 주문에 관리자가
    // 실수로 또 연결하는 통로만 열어준다. 남는 로그는 "미매칭 해제"로 정리한다.
    prisma.chargeOrder.findMany({
      where: { status: "PENDING", charged: false, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        amount: true,
        depositName: true,
        status: true,
        createdAt: true,
        user: { select: { loginId: true, name: true } },
      },
      take: 300,
    }),
  ]);

  // 미매칭(처리 필요)을 위, 최근 처리건을 아래로
  const deposits = [...unmatchedDeposits, ...recentMatched];

  const lastPage = Math.max(1, Math.ceil(count / PER));
  const norm = (s: string) => s.replace(/\s/g, "");

  type DepositItem = (typeof deposits)[number];
  const explainDeposit = (d: DepositItem) => {
    if (d.matched) {
      if (d.matchedOrderId) return `연결 주문 #${d.matchedOrderId}`;
      return "수동 확인 처리됨";
    }
    if (!d.amount) return "금액 파싱 실패";
    if (!d.depositorName.trim()) return "입금자명 파싱 실패";

    const sameAmount = matchCandidates.filter((o) => o.amount === d.amount);
    if (sameAmount.length === 0) return "같은 금액의 입금대기 주문 없음 (이미 지급했다면 해제)";

    const sameName = sameAmount.some((o) => norm(o.depositName) === norm(d.depositorName));
    return sameName
      ? "같은 이름·금액의 입금대기 주문이 있음 (아직 연결 안 됨)"
      : "금액은 맞지만 입금자명이 다른 입금대기 주문만 있음";
  };

  // 날짜별 그룹
  const groups = new Map<string, typeof orders>();
  for (const o of orders) {
    const d = ymd(o.createdAt);
    if (!groups.has(d)) groups.set(d, []);
    groups.get(d)!.push(o);
  }

  const sumAmount = orders.reduce((a, o) => a + o.amount, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <i className="fa-solid fa-building-columns text-emerald-600" aria-hidden /> 입금 확인
        </h1>
        <Link href="/admin" className="text-sm text-zinc-500 hover:text-zinc-900">
          ← 관리자 홈
        </Link>
      </div>

      <form action="/admin/charges" method="GET" className="space-y-2">
        <input type="hidden" name="status" value={status} />
        <div className="flex gap-2">
          <div className="glass flex flex-1 items-center gap-3 rounded-xl px-3.5 py-2.5">
            <i className="fa-solid fa-magnifying-glass text-zinc-400" aria-hidden />
            <input
              name="q"
              defaultValue={q}
              placeholder="회원 아이디·이름·입금자명 검색"
              aria-label="검색"
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
          <button className="rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-700">
            검색
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="shrink-0 text-zinc-500">기간</span>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <input
              type="date"
              name="from"
              defaultValue={from}
              aria-label="시작일"
              className="glass font-num min-w-0 flex-1 rounded-lg px-2 py-1.5 outline-none"
            />
            <span className="shrink-0 text-zinc-400">~</span>
            <input
              type="date"
              name="to"
              defaultValue={to}
              aria-label="종료일"
              className="glass font-num min-w-0 flex-1 rounded-lg px-2 py-1.5 outline-none"
            />
          </div>
          {(from || to) && (
            <Link
              href={`/admin/charges?status=${status}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className="shrink-0 text-xs text-zinc-400 hover:text-zinc-600"
            >
              기간 해제
            </Link>
          )}
        </div>
      </form>

      {deposits.length > 0 && (
        <details className="glass rounded-2xl p-4">
          <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
            <i className="fa-solid fa-bell text-emerald-600" aria-hidden /> 자동 입금 감지
            <span className="font-num text-xs font-normal text-zinc-400">
              최근 처리 {recentMatched.length}건
            </span>
            {unmatchedCount > 0 && (
              <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                미매칭 {unmatchedCount}
              </span>
            )}
          </summary>
          <ul className="mt-3 space-y-1.5">
            {deposits.map((d) => {
              const sameAmount = matchCandidates.filter((o) => o.amount === d.amount);
              const isSameName = (o: (typeof matchCandidates)[number]) =>
                norm(o.depositName) === norm(d.depositorName);
              const sameNameCandidates = sameAmount.filter(isSameName);
              // 입금자명이 같은 주문을 맨 위로 — 미매칭은 이름이 안 맞는 건이라 이름으로
              // 거를 수는 없지만, 맞는 게 있으면 그게 정답일 확률이 가장 높다.
              const candidates = [
                ...sameNameCandidates,
                ...sameAmount.filter((o) => !isSameName(o)),
              ];
              const unmatched = !d.matched && d.amount > 0;

              return (
                <li
                  key={d.id}
                  className="flex items-start justify-between gap-2 rounded-lg bg-black/[0.02] px-3 py-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {d.matched ? (
                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-700">
                          지급완료
                        </span>
                      ) : (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                          미매칭
                        </span>
                      )}
                      <span className="font-medium">{d.depositorName || "?"}</span>
                      <span className="font-num text-zinc-500">{won(d.amount)}</span>
                    </div>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-400">
                      {explainDeposit(d)}
                    </p>
                    {unmatched &&
                      (candidates.length > 0 ? (
                        <form action={matchDeposit} className="mt-2 flex items-center gap-2">
                          <input type="hidden" name="depositId" value={d.id} />
                          <select
                            name="orderId"
                            required
                            defaultValue=""
                            aria-label="연결할 주문"
                            className="glass min-w-0 flex-1 rounded-lg px-2.5 py-1.5 text-xs outline-none"
                          >
                            {/* 기본 선택을 비워둔다 — 첫 항목이 자동 선택돼 있으면
                                관리자가 무심코 눌러 엉뚱한 회원에게 지급될 수 있다. */}
                            <option value="" disabled>
                              — 연결할 주문 선택 —
                            </option>
                            {candidates.map((o) => (
                              <option key={o.id} value={o.id}>
                                #{o.id} · {o.depositName || "(입금자명 없음)"} ·{" "}
                                {o.user.name || o.user.loginId} · {ymd(o.createdAt).slice(5)}
                                {isSameName(o) ? " · 이름일치" : ""}
                              </option>
                            ))}
                          </select>
                          <ConfirmButton
                            message={`이 입금(${d.depositorName || "?"} · ${won(d.amount)})을 선택한 주문에 연결할까요? (아직 미지급 주문이면 충전완료도 함께 처리됩니다)`}
                            className="shrink-0 whitespace-nowrap rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500"
                          >
                            연결
                          </ConfirmButton>
                        </form>
                      ) : (
                        <form action={dismissDeposit} className="mt-1.5 flex items-center gap-2">
                          <input type="hidden" name="depositId" value={d.id} />
                          <span className="text-xs text-zinc-400">
                            같은 금액({won(d.amount)})의 입금대기 주문이 없습니다. 이미 수동
                            지급했다면 해제하세요.
                          </span>
                          <ConfirmButton
                            message={`이 입금(${d.depositorName || "?"} · ${won(d.amount)})을 미매칭 해제(수동 확인)할까요? 포인트 지급 없이 표시만 정리됩니다.`}
                            className="shrink-0 whitespace-nowrap rounded-lg border border-black/10 px-2.5 py-1 text-xs text-zinc-600 hover:bg-black/5"
                          >
                            미매칭 해제
                          </ConfirmButton>
                        </form>
                      ))}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className="font-num text-xs text-zinc-400">{ymdhm(d.createdAt).slice(5)}</span>
                    {/* 주문에 연결된 지급 기록이 아니면 삭제 허용 */}
                    {!d.matchedOrderId && (
                      <form action={deleteDeposit}>
                        <input type="hidden" name="depositId" value={d.id} />
                        <ConfirmButton
                          message={`이 입금로그(${d.depositorName || "?"} · ${won(d.amount)})를 삭제할까요? 되돌릴 수 없습니다.`}
                          title="입금로그 삭제"
                          className="whitespace-nowrap rounded-md px-2 py-0.5 text-xs text-red-500 hover:bg-red-50"
                        >
                          <i className="fa-solid fa-trash" aria-hidden /> 삭제
                        </ConfirmButton>
                      </form>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          {unmatchedDeposits.length >= 100 && (
            <p className="mt-2 text-xs text-amber-600">
              미매칭이 100건을 초과합니다. 최근 100건만 표시됩니다.
            </p>
          )}
          <p className="mt-2 text-xs text-zinc-400">
            미매칭 건은 입금자명·금액이 주문과 다르거나, 아직 연결되지 않은 경우입니다. (위: 미매칭, 아래: 최근 처리)
          </p>
        </details>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="상태 필터" className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={`/admin/charges?status=${t.key}${carry}`}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                status === t.key
                  ? "bg-zinc-900 text-white"
                  : "glass text-zinc-600 hover:bg-white/70"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
        <p className="font-num text-sm text-zinc-500">
          {q && <span className="text-emerald-600">전체 상태 검색 · </span>}
          총 {count.toLocaleString("ko-KR")}건 · 이 페이지 {won(sumAmount)}
        </p>
      </div>

      {orders.length === 0 ? (
        <p className="text-sm text-zinc-500">해당 내역이 없습니다.</p>
      ) : (
        <div className="space-y-5">
          {[...groups.entries()].map(([date, list]) => (
            <DateGroup key={date} date={date} list={list} />
          ))}
        </div>
      )}

      {lastPage > 1 && (
        <nav className="flex items-center justify-center gap-2" aria-label="페이지">
          {page > 1 && (
            <Link
              href={`/admin/charges?status=${status}${carry}&page=${page - 1}`}
              className="glass rounded-lg px-3 py-1.5 text-sm hover:bg-white/70"
            >
              이전
            </Link>
          )}
          <span className="font-num text-sm text-zinc-500">
            {page} / {lastPage}
          </span>
          {page < lastPage && (
            <Link
              href={`/admin/charges?status=${status}${carry}&page=${page + 1}`}
              className="glass rounded-lg px-3 py-1.5 text-sm hover:bg-white/70"
            >
              다음
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}

function DateGroup({
  date,
  list,
}: {
  date: string;
  list: {
    id: number;
    amount: number;
    chargePoint: number;
    depositName: string;
    status: string;
    autoConfirmed: boolean;
    createdAt: Date;
    userId: number;
    user: { loginId: string; name: string };
  }[];
}) {
  const dayTotal = list.reduce((a, o) => a + o.amount, 0);
  return (
    <section>
      <h3 className="mb-2 flex items-center justify-between px-1">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-zinc-500">
          <i className="fa-regular fa-calendar" aria-hidden /> {date}
          <span className="font-normal text-zinc-400">· {list.length}건</span>
        </span>
        <span className="font-num text-xs text-zinc-400">{won(dayTotal)}</span>
      </h3>
      <ul className="space-y-2">
        {list.map((o) => {
          const pending = o.status === "PENDING";
          return (
            <li
              key={o.id}
              className={`glass flex items-center gap-3 rounded-2xl p-4 ${
                pending ? "border-l-4 border-amber-400" : ""
              }`}
            >
              {/* 입금자 / 회원 */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-base font-bold">
                    {o.depositName || "(입금자명 없음)"}
                  </span>
                  {pending && (
                    <span className="shrink-0 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                      입금대기
                    </span>
                  )}
                </div>
                <p className="font-num mt-0.5 truncate text-xs text-zinc-400">
                  <Link
                    href={`/admin/members/${o.userId}`}
                    className="text-emerald-700 hover:underline"
                  >
                    {o.user.name || o.user.loginId}
                  </Link>{" "}
                  · {ymdhm(o.createdAt).slice(11)}
                </p>
              </div>

              {/* 금액 / 지급포인트 */}
              <div className="shrink-0 text-right">
                <p className="font-num text-lg font-bold tracking-tight">{won(o.amount)}</p>
                <p className="font-num text-xs text-emerald-600">{pt(o.chargePoint)}</p>
              </div>

              {/* 처리 */}
              <div className="flex w-[5.5rem] shrink-0 justify-end">
                {pending ? (
                  <div className="flex flex-col gap-1.5">
                    <form action={confirmCharge}>
                      <input type="hidden" name="id" value={o.id} />
                      <ConfirmButton
                        message={`[${o.depositName || "입금자명 없음"}] ${won(o.amount)} 입금을 확인하고 충전완료(${pt(o.chargePoint)} 지급) 처리할까요?`}
                        className="w-full whitespace-nowrap rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-500"
                      >
                        지급
                      </ConfirmButton>
                    </form>
                    <form action={cancelCharge}>
                      <input type="hidden" name="id" value={o.id} />
                      <ConfirmButton
                        message={`[${o.depositName || "입금자명 없음"}] ${won(o.amount)} 충전 신청을 취소할까요?`}
                        className="w-full rounded-lg border border-black/10 px-3 py-1 text-xs text-zinc-500 hover:bg-black/5"
                      >
                        취소
                      </ConfirmButton>
                    </form>
                  </div>
                ) : o.status === "CANCELED" ? (
                  <div className="flex flex-col items-end gap-1.5">
                    <span
                      className={`rounded-md px-2 py-1 text-xs font-medium ${STATUS_BADGE[o.status]}`}
                    >
                      {STATUS_LABEL[o.status]}
                    </span>
                    <form action={restoreCharge}>
                      <input type="hidden" name="id" value={o.id} />
                      <button className="whitespace-nowrap rounded-lg border border-black/10 px-2.5 py-1 text-xs text-zinc-600 hover:bg-black/5">
                        되돌리기
                      </button>
                    </form>
                  </div>
                ) : (
                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={`rounded-md px-2 py-1 text-xs font-medium ${STATUS_BADGE[o.status]}`}
                    >
                      {STATUS_LABEL[o.status]}
                    </span>
                    {o.autoConfirmed ? (
                      <span className="flex items-center gap-1 whitespace-nowrap rounded bg-sky-100 px-1.5 py-0.5 text-[11px] font-medium text-sky-700">
                        <i className="fa-solid fa-bolt" aria-hidden /> 자동
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 whitespace-nowrap rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-500">
                        <i className="fa-solid fa-hand" aria-hidden /> 수동
                      </span>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
