import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "임시 점검 중 — GetUsim",
  robots: { index: false, follow: false },
};

// 점검 안내 페이지. proxy.ts 가 점검 모드일 때 비관리자 요청을 이 경로로 rewrite(503)한다.
export default function MaintenancePage() {
  return (
    <main
      id="main"
      className="flex flex-1 items-center justify-center px-5 py-16"
    >
      <div className="glass w-full max-w-md rounded-3xl p-8 text-center sm:p-10">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
          <i className="fa-solid fa-screwdriver-wrench text-2xl" aria-hidden />
        </div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
          홈페이지 임시 점검 중
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-500">
          더 나은 서비스를 위해 시스템을 정리하고 있습니다.
          <br />
          잠시 후 다시 이용해 주세요. 이용에 불편을 드려 죄송합니다.
        </p>
        <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-black/[0.04] px-4 py-2 text-xs font-medium text-zinc-500">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          점검 작업 진행 중
        </div>
      </div>
    </main>
  );
}
