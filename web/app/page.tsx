import Link from "next/link";
import Reveal from "@/components/Reveal";
import Tilt from "@/components/Tilt";
import Footer from "@/components/Footer";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const STATS = [
  { icon: "fa-earth-americas", value: "150여 개국", label: "지원 국가" },
  { icon: "fa-grip", value: "16종", label: "지원 서비스" },
  { icon: "fa-bolt", value: "실시간", label: "SMS 수신" },
  { icon: "fa-shield-halved", value: "안전결제", label: "포인트 충전" },
];

const FLAGS = ["kr", "us", "gb", "jp", "ru", "cn", "fr", "br", "ca", "vn"];
const LOGOS = [
  "kakaotalk",
  "naver",
  "line",
  "telegram",
  "whatsapp",
  "google",
  "instagram",
  "x",
];

export default async function Home() {
  const user = await getCurrentUser();
  return (
    <div className="flex flex-1 flex-col">
      <header className="glass sticky top-0 z-40">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
        <Link href="/" className="font-mont text-xl font-extrabold tracking-tight">
          GetUsim
        </Link>
        <nav aria-label="상단 메뉴" className="flex items-center gap-2 text-sm">
          {user ? (
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 font-medium text-white transition hover:bg-zinc-700"
            >
              <i className="fa-solid fa-gauge" aria-hidden /> 대시보드
            </Link>
          ) : (
            <>
              <Link href="/login" className="rounded-xl px-4 py-2 font-medium hover:bg-black/5">
                로그인
              </Link>
              <Link
                href="/register"
                className="rounded-xl bg-zinc-900 px-4 py-2 font-medium text-white transition hover:bg-zinc-700"
              >
                회원가입
              </Link>
            </>
          )}
        </nav>
        </div>
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
          <Reveal delay={200} className="mt-2 lg:mt-0">
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
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* 전 세계 23개국 */}
            <Reveal>
              <Tilt className="h-full">
                <article className="glass flex h-full flex-col rounded-3xl p-6">
                  <div className="flex flex-wrap gap-2">
                    {FLAGS.map((f) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={f}
                        src={`https://flagcdn.com/h40/${f}.png`}
                        alt=""
                        className="h-7 w-10 rounded-md object-cover shadow-sm"
                        loading="lazy"
                      />
                    ))}
                    <span className="flex h-7 items-center rounded-md bg-zinc-900 px-2 text-xs font-bold text-white">
                      +140
                    </span>
                  </div>
                  <h3 className="mt-5 text-lg font-bold">전 세계 150여 개국</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">
                    한국·미국·영국·일본 등 전 세계 국가의 가상번호를 즉시 발급받습니다.
                  </p>
                </article>
              </Tilt>
            </Reveal>

            {/* 주요 서비스 */}
            <Reveal delay={90}>
              <Tilt className="h-full">
                <article className="glass flex h-full flex-col rounded-3xl p-6">
                  <div className="flex flex-wrap gap-2.5">
                    {LOGOS.map((s) => (
                      <span
                        key={s}
                        className="grid h-11 w-11 place-items-center rounded-2xl bg-white shadow-sm ring-1 ring-black/5"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`https://cdn.simpleicons.org/${s}`}
                          alt=""
                          className="h-6 w-6"
                          loading="lazy"
                        />
                      </span>
                    ))}
                  </div>
                  <h3 className="mt-5 text-lg font-bold">주요 서비스 지원</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">
                    카카오톡·네이버·라인·텔레그램·구글 등 16종 서비스를 지원합니다.
                  </p>
                </article>
              </Tilt>
            </Reveal>

            {/* 실시간 수신 */}
            <Reveal delay={150}>
              <Tilt className="h-full">
                <article className="glass flex h-full flex-col rounded-3xl p-6">
                  <div className="space-y-2">
                    <div className="w-fit rounded-2xl rounded-bl-sm bg-zinc-100 px-4 py-2 text-sm text-zinc-600">
                      [GetUsim] 인증번호를 입력하세요
                    </div>
                    <div className="ml-auto w-fit rounded-2xl rounded-br-sm bg-emerald-600 px-4 py-2 text-sm font-bold tracking-widest text-white">
                      738 291
                    </div>
                  </div>
                  <h3 className="mt-5 text-lg font-bold">실시간 수신</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">
                    발급 즉시 SMS 인증번호를 자동으로 받아봅니다.
                  </p>
                </article>
              </Tilt>
            </Reveal>

            {/* 합리적인 포인트 */}
            <Reveal delay={210}>
              <Tilt className="h-full">
                <article className="glass flex h-full flex-col rounded-3xl p-6">
                  <div className="flex flex-wrap items-center gap-2">
                    {["1,000P", "수신 성공 시에만", "최소 1,000P"].map((t, i) => (
                      <span
                        key={i}
                        className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
                          i === 0
                            ? "font-num bg-emerald-600 text-white"
                            : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                  <h3 className="mt-5 text-lg font-bold">합리적인 포인트</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">
                    수신에 성공했을 때만 차감됩니다. 필요한 만큼만 충전하세요.
                  </p>
                </article>
              </Tilt>
            </Reveal>
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
