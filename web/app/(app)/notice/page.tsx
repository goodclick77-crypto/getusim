import Link from "next/link";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ymd } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function NoticePage() {
  await requireUser();
  const notices = await prisma.notice.findMany({
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    take: 100,
  });

  return (
    <div className="space-y-6">
      <h1 className="flex items-center gap-2 text-xl font-bold">
        <i className="fa-solid fa-bullhorn text-emerald-600" aria-hidden /> 공지사항
      </h1>

      {notices.length === 0 ? (
        <p className="text-sm text-zinc-500">등록된 공지가 없습니다.</p>
      ) : (
        <ul className="glass divide-y divide-black/5 rounded-2xl">
          {notices.map((n) => (
            <li key={n.id}>
              <Link
                href={`/notice/${n.id}`}
                className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-black/[0.03]"
              >
                {n.pinned ? (
                  <span className="rounded-md bg-emerald-600/10 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                    공지
                  </span>
                ) : (
                  <i className="fa-regular fa-file-lines text-zinc-400" aria-hidden />
                )}
                <span className="flex-1 truncate font-medium">{n.title}</span>
                <span className="font-num shrink-0 text-xs text-zinc-400">
                  {ymd(n.createdAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
