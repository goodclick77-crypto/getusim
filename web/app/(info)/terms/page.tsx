import type { Metadata } from "next";

export const metadata: Metadata = { title: "이용약관 — GetUsim" };

const SECTIONS: { h: string; body: string[] }[] = [
  {
    h: "제1조 (목적)",
    body: [
      "이 약관은 GetUsim(이하 “회사”)이 제공하는 글로벌 SMS 인증 및 포인트 충전 서비스(이하 “서비스”)의 이용과 관련하여 회사와 이용자 간의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.",
    ],
  },
  {
    h: "제2조 (정의)",
    body: [
      "“서비스”란 회사가 제공하는 가상번호 SMS 인증번호 수신 및 포인트 충전 기능 일체를 말합니다.",
      "“회원”이란 본 약관에 동의하고 서비스 이용 자격을 부여받은 자를 말합니다.",
      "“포인트”란 서비스 이용을 위해 회원이 충전하여 사용하는 사이버 자산을 말합니다.",
    ],
  },
  {
    h: "제3조 (서비스의 이용)",
    body: [
      "회원은 포인트를 충전한 후, 원하는 국가 및 서비스의 가상번호를 발급받아 SMS 인증번호를 수신할 수 있습니다.",
      "번호 발급은 무료이며, 인증번호가 정상 수신된 경우에 한하여 정해진 포인트가 차감됩니다.",
      "인증번호 미수신 시 회원은 ‘밴넘버’ 처리를 통해 다른 번호로 재시도할 수 있습니다.",
    ],
  },
  {
    h: "제4조 (포인트 및 결제)",
    body: [
      "포인트는 회사가 정한 방법(무통장입금 등)으로 충전할 수 있습니다.",
      "충전된 포인트의 유효기간 및 환불 정책은 관련 법령 및 회사의 정책에 따릅니다.",
      "인증번호 수신이 완료된 건에 대해서는 어떠한 경우에도 환불이 불가능합니다.",
    ],
  },
  {
    h: "제5조 (이용자의 의무)",
    body: [
      "회원은 서비스를 통해 제공받은 가상번호를 현지 법률 및 규정을 준수하여 합법적인 용도로만 사용하여야 합니다.",
      "불법적인 용도로 사용하여 발생하는 모든 책임은 이용자 본인에게 있으며, 회사는 관련 기관의 요청 시 조사에 필요한 정보를 제공할 수 있습니다.",
    ],
  },
  {
    h: "제6조 (면책)",
    body: [
      "회사는 천재지변, 제3자(공급사 등)의 사정, 통신 장애 등 회사의 통제 범위를 벗어난 사유로 인한 서비스 중단·지연에 대하여 책임을 지지 않습니다.",
    ],
  },
];

export default function TermsPage() {
  return (
    <article className="glass rounded-3xl p-8">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <i className="fa-solid fa-file-contract text-emerald-600" aria-hidden /> 이용약관
      </h1>
      <div className="mt-6 space-y-7">
        {SECTIONS.map((s) => (
          <section key={s.h}>
            <h2 className="font-bold text-zinc-800">{s.h}</h2>
            <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-zinc-600">
              {s.body.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </article>
  );
}
