import Link from "next/link";

export default function NotFound() {
  return (
    <section className="mx-auto flex w-full max-w-2xl flex-1 items-center px-5 py-16 sm:px-8">
      <div className="glass w-full rounded-3xl p-8 text-center sm:p-12">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-50 text-emerald-600">
          <i className="fa-solid fa-triangle-exclamation text-2xl" aria-hidden />
        </div>
        <h1 className="mt-6 text-3xl font-bold tracking-tight text-zinc-900">페이지를 찾을 수 없어요</h1>
        <p className="mt-4 leading-relaxed text-zinc-600">
          입력하신 주소가 없거나, 삭제되었거나, 잘못 입력되었을 수 있습니다.
          <br />
          아래 버튼을 눌러 메인 화면으로 돌아가세요.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-5 py-3 font-medium text-white transition hover:bg-zinc-700"
          >
            <i className="fa-solid fa-house" aria-hidden /> 메인으로 돌아가기
          </Link>
          <Link
            href="/prices"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-5 py-3 font-medium text-zinc-800 transition hover:bg-zinc-50"
          >
            <i className="fa-solid fa-tag" aria-hidden /> 가격표 보기
          </Link>
        </div>
      </div>
    </section>
  );
}
