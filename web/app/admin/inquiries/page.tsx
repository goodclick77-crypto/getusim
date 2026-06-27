import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ymdhm, pt, won, dateRange } from "@/lib/format";
import { chargeAmount } from "@/lib/config";
import {
  answerInquiry,
  deleteInquiry,
  updateReply,
  approveRefund,
  hideInquiry,
  unhideInquiry,
} from "../actions";
import ConfirmButton from "@/components/ConfirmButton";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "OPEN", label: "미답변" },
  { key: "ANSWERED", label: "답변완료" },
  { key: "ALL", label: "전체" },
  { key: "HIDDEN", label: "보관" },
] as const;

const CAT_LABEL: Record<string, string> = {
  USAGE: "사용문의",
  REFUND: "환불문의",
  OTHER: "기타문의",
};

export default async function AdminInquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; from?: string; to?: string; ok?: string; error?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const status = (sp.status || "OPEN").toUpperCase();
  const from = (sp.from || "").trim();
  const to = (sp.to || "").trim();
  const createdAt = dateRange(from, to);
  const isHidden = status === "HIDDEN";
  const where = {
    parentId: null,
    hidden: isHidden, // 기본 탭은 보관 제외, '보관' 탭에서만 숨긴 것 표시
    ...(status === "ALL" || isHidden
      ? {}
      : { status: status as "OPEN" | "ANSWERED" }),
    ...(createdAt ? { createdAt } : {}),
  };

  const inquiries = await prisma.inquiry.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { replies: { orderBy: { createdAt: "asc" } } },
    take: 100,
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <i className="fa-solid fa-comments text-emerald-600" aria-hidden /> 문의 관리
        </h1>
        <Link href="/admin" className="text-sm text-zinc-500 hover:text-zinc-900">
          ← 관리자 홈
        </Link>
      </div>

      {sp.ok === "refund" && (
        <p role="status" className="glass rounded-2xl px-4 py-3 text-sm text-emerald-700">
          환불 승인 완료 — 신청 포인트가 차감되었습니다.
        </p>
      )}
      {sp.error === "insufficient" && (
        <p role="alert" className="glass rounded-2xl px-4 py-3 text-sm text-red-600">
          회원의 보유 포인트가 환불 신청 포인트보다 적어 차감할 수 없습니다.
        </p>
      )}
      {sp.error === "refund_invalid" && (
        <p role="alert" className="glass rounded-2xl px-4 py-3 text-sm text-red-600">
          이미 처리되었거나 환불 정보가 올바르지 않은 신청입니다.
        </p>
      )}

      <nav aria-label="상태 필터" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/inquiries?status=${t.key}${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}`}
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

      <form action="/admin/inquiries" method="GET" className="flex flex-wrap items-center gap-2 text-sm">
        <input type="hidden" name="status" value={status} />
        <span className="text-zinc-500">기간</span>
        <input
          type="date"
          name="from"
          defaultValue={from}
          aria-label="시작일"
          className="glass font-num rounded-lg px-3 py-1.5 outline-none"
        />
        <span className="text-zinc-400">~</span>
        <input
          type="date"
          name="to"
          defaultValue={to}
          aria-label="종료일"
          className="glass font-num rounded-lg px-3 py-1.5 outline-none"
        />
        <button className="rounded-lg bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-700">
          조회
        </button>
        {(from || to) && (
          <Link
            href={`/admin/inquiries?status=${status}`}
            className="text-xs text-zinc-400 hover:text-zinc-600"
          >
            기간 해제
          </Link>
        )}
      </form>

      {inquiries.length === 0 ? (
        <p className="text-sm text-zinc-500">해당 문의가 없습니다.</p>
      ) : (
        <ul className="space-y-3">
          {inquiries.map((q) => (
            <li key={q.id} className="glass rounded-2xl p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="flex min-w-0 items-center gap-2 font-semibold">
                  <span
                    className={`shrink-0 rounded-md px-1.5 py-0.5 text-xs font-medium ${
                      q.category === "REFUND"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-zinc-100 text-zinc-600"
                    }`}
                  >
                    {CAT_LABEL[q.category] ?? "문의"}
                  </span>
                  <span className="truncate">{q.title}</span>
                </p>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={
                      q.status === "ANSWERED" ? "text-sm text-emerald-600" : "text-sm text-amber-600"
                    }
                  >
                    {q.status === "ANSWERED" ? "답변완료" : "미답변"}
                  </span>
                  {isHidden ? (
                    <form action={unhideInquiry}>
                      <input type="hidden" name="id" value={q.id} />
                      <button
                        title="복원(보관 해제)"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 px-2.5 py-1 text-xs font-medium text-emerald-700 transition hover:bg-emerald-50"
                      >
                        <i className="fa-solid fa-rotate-left" aria-hidden /> 복원
                      </button>
                    </form>
                  ) : (
                    <form action={hideInquiry}>
                      <input type="hidden" name="id" value={q.id} />
                      <button
                        title="보관(목록에서 숨김 · 사용자 기록은 유지)"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-black/10 px-2.5 py-1 text-xs font-medium text-zinc-600 transition hover:bg-black/5"
                      >
                        <i className="fa-solid fa-box-archive" aria-hidden /> 보관
                      </button>
                    </form>
                  )}
                  <form action={deleteInquiry}>
                    <input type="hidden" name="id" value={q.id} />
                    <ConfirmButton
                      message="이 문의를 삭제하시겠습니까? 답변도 함께 삭제됩니다."
                      title="삭제 (스팸 등)"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50"
                    >
                      <i className="fa-solid fa-trash" aria-hidden /> 삭제
                    </ConfirmButton>
                  </form>
                </div>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-600">{q.content}</p>
              <p className="font-num mt-1 text-xs text-zinc-400">
                {q.name} · {ymdhm(q.createdAt)}
              </p>

              {q.category === "REFUND" && (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm">
                  <p className="flex items-center gap-1.5 font-semibold text-amber-700">
                    <i className="fa-solid fa-rotate-left" aria-hidden /> 환불 신청
                  </p>
                  <p className="font-num mt-1">
                    환불 포인트(전액): <b>{pt(q.refundPoint ?? 0)}</b>
                  </p>
                  <p className="font-num mt-0.5 text-base">
                    입금할 금액: <b className="text-amber-700">{won(chargeAmount(q.refundPoint ?? 0))}</b>
                    <span className="ml-1 text-xs font-normal text-zinc-500">(부가세 포함)</span>
                  </p>
                  {q.refundInfo && (
                    <p className="mt-1 whitespace-pre-wrap text-zinc-600">
                      환불 정보: {q.refundInfo}
                    </p>
                  )}
                  {q.refundedAt ? (
                    <p className="mt-2 flex items-center gap-1.5 text-emerald-700">
                      <i className="fa-solid fa-circle-check" aria-hidden /> 환불 승인됨(포인트 차감
                      완료) · {ymdhm(q.refundedAt)}
                    </p>
                  ) : (
                    <form action={approveRefund} className="mt-2">
                      <input type="hidden" name="id" value={q.id} />
                      <ConfirmButton
                        message={`${q.name}님 환불 승인: 포인트 ${pt(q.refundPoint ?? 0)} 차감 / 계좌로 ${won(chargeAmount(q.refundPoint ?? 0))}(부가세 포함) 입금. 진행할까요? (실제 송금은 별도로 진행)`}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-500"
                      >
                        <i className="fa-solid fa-check" aria-hidden /> 환불 승인 (포인트 차감)
                      </ConfirmButton>
                    </form>
                  )}
                </div>
              )}

              {q.replies.map((rep) => (
                <div key={rep.id} className="mt-3 rounded-xl bg-emerald-50/70 p-3">
                  <div className="flex items-center justify-between">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                      <i className="fa-solid fa-reply" aria-hidden /> 답변
                    </p>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-700">{rep.content}</p>
                  <details className="group mt-1.5">
                    <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600 [&::-webkit-details-marker]:hidden">
                      <i className="fa-solid fa-pen" aria-hidden /> 수정
                    </summary>
                    <form action={updateReply} className="mt-2 space-y-2">
                      <input type="hidden" name="id" value={rep.id} />
                      <textarea
                        name="content"
                        defaultValue={rep.content}
                        rows={3}
                        aria-label="답변 수정"
                        className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
                      />
                      <button className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700">
                        답변 수정 저장
                      </button>
                    </form>
                  </details>
                </div>
              ))}

              <form action={answerInquiry} className="mt-3 space-y-2">
                <input type="hidden" name="parentId" value={q.id} />
                <textarea
                  name="content"
                  rows={3}
                  placeholder={
                    q.status === "ANSWERED"
                      ? "추가 답변 입력 (엔터로 줄바꿈)"
                      : "답변 입력 (엔터로 줄바꿈)"
                  }
                  aria-label="답변"
                  className="w-full rounded-xl border border-black/10 bg-white/60 px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
                />
                <div className="flex justify-end">
                  <button className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm text-white transition hover:bg-zinc-700">
                    <i className="fa-solid fa-paper-plane" aria-hidden /> 답변 등록
                  </button>
                </div>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
