import Link from "next/link";
import Reveal from "@/components/Reveal";
import Tilt from "@/components/Tilt";
import Footer from "@/components/Footer";

const STATS = [
  { icon: "fa-earth-americas", value: "23개국", label: "지원 국가" },
  { icon: "fa-grip", value: "23종", label: "지원 서비스" },
  { icon: "fa-bolt", value: "실시간", label: "SMS 수신" },
  { icon: "fa-shield-halved", value: "안전결제", label: "포인트 충전" },
];

const FEATURES = [
  { icon: "fa-earth-americas", title: "전 세계 23개국", desc: "미국·러시아·영국 등 다양한 국가의 가상번호를 즉시 발급받습니다.", grad: "from-sky-500 to-blue-600" },
  { icon: "fa-bolt", title: "실시간 수신", desc: "발급 즉시 SMS 인증번호를 자동으로 받아봅니다.", grad: "from-amber-400 to-orange-500" },
  { icon: "fa-coins", title: "합리적인 포인트", desc: "수신 성공 시에만 차감. 필요한 만큼만 충전하세요.", grad: "from-emerald-500 to-teal-600" },
  { icon: "fa-comments", title: "주요 서비스 지원", desc: "텔레그램·왓츠앱·구글·인스타그램 등 23종.", grad: "from-violet-500 to-purple-600" },
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
        {/* 히어로 */}
        <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 pb-12 pt-20 lg:grid-cols-2 lg:pt-28">
          <div>
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-sm font-medium text-emerald-700">
                <i className="fa-solid fa-circle-check" aria-hidden /> 글로벌 SMS 인증 서비스
              </span>
            </Reveal>
            <Reveal delay={80}>
              <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
                전 세계 가상번호로
                <br />
                <span className="text-emerald-600">SMS 인증</span>을 한 번에
              </h1>
            </Reveal>
            <Reveal delay={160}>
              <p className="mt-6 max-w-md text-lg leading-relaxed text-zinc-600">
                포인트를 충전하고 원하는 서비스의 인증번호를 즉시 수신하세요. 복잡한
                절차 없이 클릭 한 번이면 됩니다.
              </p>
            </Reveal>
            <Reveal delay={240}>
              <dl className="mt-10 grid max-w-md grid-cols-2 gap-3 sm:grid-cols-4">
                {STATS.map((s) => (
                  <div key={s.label} className="glass rounded-2xl p-3 text-center">
                    <i className={`fa-solid ${s.icon} text-emerald-600`} aria-hidden />
                    <dt className="font-num mt-1.5 text-base font-bold text-zinc-900">{s.value}</dt>
                    <dd className="text-xs text-zinc-500">{s.label}</dd>
                  </div>
                ))}
              </dl>
            </Reveal>
          </div>

          {/* 제품 미리보기 목업 */}
          <Reveal delay={200} className="hidden lg:block">
            <Tilt max={6}>
              <PhonePreview />
            </Tilt>
          </Reveal>
        </section>

        {/* 기능 */}
        <section aria-label="주요 기능" className="mx-auto w-full max-w-6xl px-6 py-16">
          <Reveal>
            <h2 className="text-center text-2xl font-bold sm:text-3xl">
              왜 <span className="text-emerald-600">GetUsim</span>인가요?
            </h2>
          </Reveal>
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 90}>
                <Tilt className="h-full">
                  <article className="glass relative h-full overflow-hidden rounded-3xl p-6">
                    <span
                      className={`mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br ${f.grad} text-2xl text-white shadow-lg`}
                    >
                      <i className={`fa-solid ${f.icon}`} aria-hidden />
                    </span>
                    <h3 className="text-lg font-bold">{f.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-600">{f.desc}</p>
                    <div
                      className={`pointer-events-none absolute -bottom-10 -right-10 h-32 w-32 rounded-full bg-gradient-to-br ${f.grad} opacity-10 blur-2xl`}
                    />
                  </article>
                </Tilt>
              </Reveal>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

/** 히어로용 SMS 인증 화면 목업 */
function PhonePreview() {
  return (
    <div className="glass-dark mx-auto w-full max-w-sm rounded-[2rem] p-5 text-white shadow-2xl">
      <div className="mb-4 flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <i className="fa-solid fa-comment-sms text-emerald-400" aria-hidden /> SMS 인증
        </span>
        <span className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        </span>
      </div>

      <div className="flex gap-2">
        <span className="flex flex-1 items-center gap-2 rounded-xl bg-white/10 px-3 py-2.5 text-sm">
          <i className="fa-solid fa-flag text-emerald-400" aria-hidden /> 미국
        </span>
        <span className="flex flex-1 items-center gap-2 rounded-xl bg-white/10 px-3 py-2.5 text-sm">
          <i className="fa-brands fa-telegram text-emerald-400" aria-hidden /> 텔레그램
        </span>
      </div>

      <div className="mt-3 rounded-2xl bg-white/5 p-4">
        <p className="text-xs text-zinc-400">발급된 번호</p>
        <p className="font-num mt-1 text-xl font-bold tracking-wide">+1 468 500 5762</p>
        <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
          <span className="text-xs text-zinc-400">인증코드</span>
          <span className="font-num rounded-lg bg-emerald-500/20 px-3 py-1 text-lg font-bold tracking-widest text-emerald-300">
            738 291
          </span>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-300">
        <i className="fa-solid fa-circle-check" aria-hidden /> 인증코드 수신 완료
      </div>
    </div>
  );
}
