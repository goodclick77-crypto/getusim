import type { Metadata } from "next";

export const metadata: Metadata = { title: "개인정보처리방침 — GetUsim" };

const SECTIONS: { h: string; body: string[] }[] = [
  {
    h: "1. 수집하는 개인정보 항목",
    body: [
      "회원가입 및 서비스 이용 과정에서 아이디, 비밀번호, 이름, 이메일을 수집합니다.",
      "서비스 이용 과정에서 접속 IP, 이용 기록, 결제(포인트 충전) 기록이 자동으로 생성·수집될 수 있습니다.",
    ],
  },
  {
    h: "2. 개인정보의 수집 및 이용 목적",
    body: [
      "회원 식별 및 관리, 서비스 제공(가상번호 발급·SMS 인증), 포인트 충전 및 정산, 고객 문의 응대, 부정 이용 방지를 위해 이용합니다.",
    ],
  },
  {
    h: "3. 개인정보의 보유 및 이용 기간",
    body: [
      "회원 탈퇴 시 지체 없이 파기함을 원칙으로 합니다. 다만 관계 법령에 따라 보존이 필요한 경우 해당 기간 동안 보관합니다.",
      "전자상거래 등에서의 소비자보호에 관한 법률 등에 따른 결제·계약 관련 기록은 법정 기간 동안 보관합니다.",
    ],
  },
  {
    h: "4. 개인정보의 제3자 제공",
    body: [
      "회사는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다. 다만 법령에 근거하거나 수사기관의 적법한 요청이 있는 경우 제공할 수 있습니다.",
    ],
  },
  {
    h: "5. 이용자의 권리",
    body: [
      "이용자는 언제든지 자신의 개인정보를 조회·수정하거나 회원 탈퇴를 통해 삭제를 요청할 수 있습니다.",
    ],
  },
  {
    h: "6. 개인정보의 안전성 확보 조치",
    body: [
      "비밀번호는 암호화하여 저장·관리하며, 개인정보에 대한 접근 권한을 최소한으로 제한하는 등 안전성 확보를 위한 조치를 취하고 있습니다.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <article className="glass rounded-3xl p-8">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <i className="fa-solid fa-user-shield text-emerald-600" aria-hidden /> 개인정보처리방침
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
