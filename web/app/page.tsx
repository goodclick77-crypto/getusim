import Link from "next/link";
import Reveal from "@/components/Reveal";
import Tilt from "@/components/Tilt";

const FEATURES = [
  { icon: "fa-globe", title: "전 세계 23개국", desc: "미국·러시아·영국 등 다양한 국가의 가상번호를 즉시 발급받습니다.", cls: "sm:col-span-2" },
  { icon: "fa-bolt", title: "실시간 수신", desc: "발급 즉시 SMS 인증번호를 자동으로 받아봅니다.", cls: "" },
  { icon: "fa-shield-halved", title: "안전한 결제", desc: "포인트 충전으로 필요한 만큼만.", cls: "" },
  { icon: "fa-comment-sms", title: "주요 서비스 지원", desc: "텔레그램·왓츠앱·구글·인스타 등 23종.", cls: "sm:col-span-2" },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="glass sticky top-0 z-40 flex items-center justify-between px-5 py-3.5 sm:px-8">
        <span className="font-mont text-xl font-extrabold tracking-tight">GetUsim</span>
        <nav aria-label="상단 메뉴" className="flex items-center gap-2 text-sm">
          <Link href="/login" className="rounded-xl px-4 py-2 font-medium hover:bg-black/5">
            로그인
          </Link>
          <Link
            href="/register"
            className="rounded-xl bg-zinc-900 px-4 py-2 font-medium text-white transition hover:bg-zinc-700"
          >
            회원가입
          </Link>
        </nav>
      </header>

      <main id="main" className="flex flex-1 flex-col">
        <section className="mx-auto w-full max-w-5xl px-5 pb-10 pt-20 text-center sm:pt-28">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-sm font-medium text-emerald-700">
              <i className="fa-solid fa-circle-check" aria-hidden /> 글로벌 SMS 인증 서비스
            </span>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
              전 세계 가상번호로
              <br />
              <span className="text-emerald-600">SMS 인증</span>을 한 번에
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="mx-auto mt-6 max-w-xl text-lg text-zinc-600">
              포인트를 충전하고 원하는 서비스의 인증번호를 즉시 수신하세요. 복잡한 절차
              없이 클릭 한 번이면 됩니다.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div className="mt-9 flex justify-center gap-3">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3.5 font-semibold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-500"
              >
                <i className="fa-solid fa-rocket" aria-hidden /> 시작하기
              </Link>
              <Link
                href="/login"
                className="glass inline-flex items-center gap-2 rounded-2xl px-6 py-3.5 font-semibold hover:bg-white/70"
              >
                로그인
              </Link>
            </div>
          </Reveal>
        </section>

        <section
          aria-label="주요 기능"
          className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-4 px-5 py-12 sm:grid-cols-3"
        >
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 90} className={f.cls}>
              <Tilt className="h-full">
                <article className="glass flex h-full flex-col gap-3 rounded-3xl p-6">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-600/10 text-xl text-emerald-600">
                    <i className={`fa-solid ${f.icon}`} aria-hidden />
                  </span>
                  <h2 className="text-lg font-bold">{f.title}</h2>
                  <p className="text-sm leading-relaxed text-zinc-600">{f.desc}</p>
                </article>
              </Tilt>
            </Reveal>
          ))}
        </section>
      </main>

      <footer className="mt-auto border-t border-black/5 px-5 py-8 text-center text-sm text-zinc-500">
        <p className="font-num">© {new Date().getFullYear()} GetUsim. All rights reserved.</p>
      </footer>
    </div>
  );
}
