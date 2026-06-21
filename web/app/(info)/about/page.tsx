import type { Metadata } from "next";

export const metadata: Metadata = { title: "사이트정보 — GetUsim" };

export default function AboutPage() {
  return (
    <article className="glass rounded-3xl p-8">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <i className="fa-solid fa-circle-info text-emerald-600" aria-hidden /> 사이트정보
      </h1>
      <p className="mt-5 leading-relaxed text-zinc-700">
        <b>GetUsim</b>은 전 세계 가상번호로 SMS 인증번호를 수신할 수 있는 글로벌 SMS
        인증 서비스입니다. 포인트를 충전하여 필요한 만큼만 합리적으로 이용하실 수
        있습니다.
      </p>

      <dl className="mt-8 divide-y divide-black/5 text-sm">
        {[
          ["서비스명", "GetUsim (겟유심)"],
          ["제공 서비스", "글로벌 가상번호 SMS 인증, 포인트 충전"],
          ["지원 국가", "미국·러시아·영국 등 23개국"],
          ["지원 서비스", "텔레그램·왓츠앱·구글·인스타그램 등 23종"],
          ["고객지원", "1:1 문의 게시판"],
        ].map(([k, v]) => (
          <div key={k} className="grid grid-cols-[5.5rem_1fr] gap-3 py-3 sm:gap-4">
            <dt className="text-zinc-500">{k}</dt>
            <dd className="font-medium text-zinc-800">{v}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-8 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
        본 서비스의 가상번호는 합법적인 용도로만 사용하셔야 하며, 모든 책임은
        이용자에게 있습니다. 불법적인 용도로 사용하지 마세요.
      </p>
    </article>
  );
}
