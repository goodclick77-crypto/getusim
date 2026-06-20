import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { pt, won, ymd, ymdhm } from "@/lib/format";
import { adjustMemberPoint, toggleBlock } from "../actions";

export const dynamic = "force-dynamic";

export default async function MemberDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const userId = Number(id);
  if (!userId) notFound();

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) notFound();

  const [points, charges, inquiries] = await Promise.all([
    prisma.pointLog.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 15 }),
    prisma.chargeOrder.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.inquiry.findMany({
      where: { userId, parentId: null },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const INFO: [string, string][] = [
    ["아이디", user.loginId],
    ["이름", user.name || "-"],
    ["이메일", user.email || "-"],
    ["휴대폰", user.phone || "-"],
    ["등급", user.role === "ADMIN" ? "관리자" : `일반(lv.${user.level})`],
    ["가입일", ymd(user.createdAt)],
    ["최근접속", user.lastLoginAt ? ymdhm(user.lastLoginAt) : "-"],
    ["상태", user.leftAt ? "이용정지" : "정상"],
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <i className="fa-solid fa-user text-emerald-600" aria-hidden /> {user.name || user.loginId}
        </h1>
        <Link href="/admin/members" className="text-sm text-zinc-500 hover:text-zinc-900">
          ← 회원 목록
        </Link>
      </div>

      {sp.ok && (
        <p role="status" className="glass rounded-2xl px-4 py-3 text-sm text-emerald-700">
          포인트가 조정되었습니다.
        </p>
      )}
      {sp.error && (
        <p role="alert" className="glass rounded-2xl px-4 py-3 text-sm text-red-600">
          {sp.error === "insufficient" ? "차감액이 보유 포인트보다 큽니다." : "입력값을 확인하세요."}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* 회원 정보 */}
        <section className="glass rounded-2xl p-5">
          <h2 className="mb-3 font-bold">회원 정보</h2>
          <dl className="divide-y divide-black/5 text-sm">
            {INFO.map(([k, v]) => (
              <div key={k} className="grid grid-cols-3 gap-2 py-2">
                <dt className="text-zinc-500">{k}</dt>
                <dd className="col-span-2 font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          <form action={toggleBlock} className="mt-4">
            <input type="hidden" name="userId" value={user.id} />
            <button
              className={`rounded-xl px-4 py-2 text-sm font-medium ${
                user.leftAt
                  ? "bg-emerald-600 text-white hover:bg-emerald-500"
                  : "border border-red-200 text-red-600 hover:bg-red-50"
              }`}
            >
              {user.leftAt ? "이용정지 해제" : "이용정지(차단)"}
            </button>
          </form>
        </section>

        {/* 포인트 조정 */}
        <section className="glass-dark rounded-2xl p-5 text-white">
          <h2 className="flex items-center gap-2 font-bold">
            <i className="fa-solid fa-coins text-emerald-400" aria-hidden /> 포인트 관리
          </h2>
          <p className="mt-3 text-sm text-zinc-400">현재 보유</p>
          <p className="font-num text-3xl font-bold">{pt(user.point)}</p>

          <form action={adjustMemberPoint} className="mt-5 space-y-3">
            <input type="hidden" name="userId" value={user.id} />
            <input
              name="amount"
              type="number"
              placeholder="지급은 양수, 차감은 음수 (예: 1000 또는 -500)"
              aria-label="조정 포인트"
              className="w-full rounded-xl bg-white/10 px-3.5 py-3 text-white placeholder:text-zinc-400 outline-none focus:bg-white/15"
            />
            <input
              name="reason"
              placeholder="사유 (예: 이벤트 지급, 오류 정정)"
              aria-label="사유"
              className="w-full rounded-xl bg-white/10 px-3.5 py-3 text-white placeholder:text-zinc-400 outline-none focus:bg-white/15"
            />
            <button className="w-full rounded-xl bg-emerald-500 py-3 font-semibold text-white transition hover:bg-emerald-400">
              포인트 적용
            </button>
          </form>
        </section>
      </div>

      {/* 포인트 내역 */}
      <section className="glass rounded-2xl p-5">
        <h2 className="mb-3 font-bold">포인트 내역</h2>
        {points.length === 0 ? (
          <p className="text-sm text-zinc-500">내역 없음</p>
        ) : (
          <ul className="divide-y divide-black/5 text-sm">
            {points.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2">
                <div>
                  <p>{p.reason || "포인트 변동"}</p>
                  <p className="font-num text-xs text-zinc-400">{ymdhm(p.createdAt)}</p>
                </div>
                <span className={`font-num font-semibold ${p.amount >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                  {p.amount >= 0 ? "+" : ""}
                  {pt(p.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* 충전 내역 */}
        <section className="glass rounded-2xl p-5">
          <h2 className="mb-3 font-bold">충전 내역</h2>
          {charges.length === 0 ? (
            <p className="text-sm text-zinc-500">내역 없음</p>
          ) : (
            <ul className="divide-y divide-black/5 text-sm">
              {charges.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-2">
                  <span className="font-num">
                    {won(c.amount)} → {pt(c.chargePoint)}
                  </span>
                  <span className="font-num text-xs text-zinc-400">{ymd(c.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 문의 내역 */}
        <section className="glass rounded-2xl p-5">
          <h2 className="mb-3 font-bold">문의 내역</h2>
          {inquiries.length === 0 ? (
            <p className="text-sm text-zinc-500">내역 없음</p>
          ) : (
            <ul className="divide-y divide-black/5 text-sm">
              {inquiries.map((q) => (
                <li key={q.id} className="flex items-center justify-between py-2">
                  <span className="truncate">{q.title}</span>
                  <span
                    className={`ml-2 shrink-0 text-xs ${q.status === "ANSWERED" ? "text-emerald-600" : "text-amber-600"}`}
                  >
                    {q.status === "ANSWERED" ? "답변완료" : "미답변"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
