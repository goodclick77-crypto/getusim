import type { Metadata } from "next";
import Link from "next/link";
import { COMPANY } from "@/lib/company";
import { SMS_WAIT_MS } from "@/lib/config";

export const metadata: Metadata = { title: "환불규정 — GetUsim" };

/**
 * 환불규정 페이지.
 *
 * 전자상거래법상 "용역 제공이 개시된 후" 청약철회를 제한하려면 그 사실을 사전에 명확히 고지해야
 * 한다. 인증코드가 도착한 순간 서비스가 완료되므로 그 건은 환불이 안 된다는 것, 반대로 코드를
 * 못 받은 건은 아예 과금되지 않는다는 것을 결제수단과 무관하게 한 페이지에 적어 둔다.
 * PG 심사에서도 이 페이지를 본다.
 */
const WAIT_MIN = Math.round(SMS_WAIT_MS / 60000);

const SECTIONS: { icon: string; h: string; body: React.ReactNode[] }[] = [
  {
    icon: "fa-comment-sms",
    h: "1. 인증 이용 건의 환불",
    body: [
      <>
        번호 발급은 무료이며, <b>인증코드가 정상 수신된 경우에만</b> 해당 건의 요금이
        차감됩니다.
      </>,
      <>
        인증코드가 수신된 건은 서비스 제공이 완료된 것이므로 <b>환불이 불가능</b>합니다. (전자상거래
        등에서의 소비자보호에 관한 법률 제17조 제2항에 따른 청약철회 제한)
      </>,
      <>
        발급 후 {WAIT_MIN}분 안에 인증코드가 오지 않으면 자동으로 취소되며, <b>요금이 전혀 차감되지
        않습니다.</b> 별도의 환불 신청이 필요 없습니다.
      </>,
      <>
        인증코드가 도착했는데 대상 서비스(앱)에서 가입이 거절되는 등 회사가 통제할 수 없는 사유는
        환불 대상이 아닙니다.
      </>,
    ],
  },
  {
    icon: "fa-coins",
    h: "2. 미사용 잔액의 환불",
    body: [
      <>
        충전 후 사용하지 않은 잔액은 <b>보유 잔액 전액</b>에 한해 환불을 신청할 수 있습니다.
        (부분 환불은 받지 않습니다)
      </>,
      <>환불 금액은 화면에 표시된 보유 잔액 전액이며, 별도 수수료를 공제하지 않습니다.</>,
      <>
        신청 방법: 로그인 후{" "}
        <Link href="/inquiry" className="text-emerald-700 underline underline-offset-2">
          1:1 문의
        </Link>{" "}
        → 문의 유형 <b>환불문의</b> 선택 → 환불받을 계좌(은행·계좌번호·예금주)와 연락처를 남겨
        주세요.
      </>,
      <>
        처리 기간: 신청 확인 후 <b>영업일 기준 3일 이내</b>에 신청하신 계좌로 송금됩니다. 승인 시
        잔액은 즉시 0원으로 차감됩니다.
      </>,
      <>관리자가 임의로 지급한 이벤트·보상 금액은 환불 대상에서 제외됩니다.</>,
    ],
  },
  {
    icon: "fa-credit-card",
    h: "3. 결제수단별 처리",
    body: [
      <>
        <b>무통장입금</b>: 신청하신 계좌로 송금해 드립니다. 입금자명·금액이 신청 내용과 달라
        자동 확인이 안 된 입금은 1:1 문의로 알려주시면 확인 후 처리합니다.
      </>,
      <>
        <b>신용카드·간편결제</b>(도입 시): 인증코드를 받지 못한 건은 결제 승인이 자동으로
        취소되며, 카드사 정책에 따라 영업일 3~7일 내 승인 취소가 반영됩니다. 이미 인증이 완료된
        건은 승인 취소가 불가능합니다.
      </>,
    ],
  },
  {
    icon: "fa-scale-balanced",
    h: "4. 기타",
    body: [
      <>
        회원 탈퇴 전 미사용 잔액 환불을 먼저 신청해 주세요. 탈퇴 후에는 잔액이 소멸되어
        환불이 불가능합니다.
      </>,
      <>
        서비스를 불법적인 용도로 사용하여 이용이 제한된 회원의 잔액은 환불되지 않을 수
        있습니다.
      </>,
      <>본 규정에 정하지 않은 사항은 이용약관 및 관계 법령에 따릅니다.</>,
    ],
  },
];

export default function RefundPage() {
  return (
    <article className="glass rounded-3xl p-8">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <i className="fa-solid fa-rotate-left text-emerald-600" aria-hidden /> 환불규정
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-zinc-600">
        GetUsim은 인증코드가 <b>실제로 도착한 건에만</b> 요금을 받습니다. 받지 못한 건은 처음부터
        차감되지 않으니 환불을 따로 신청하실 필요가 없습니다.
      </p>

      <div className="mt-8 space-y-7">
        {SECTIONS.map((s) => (
          <section key={s.h}>
            <h2 className="flex items-center gap-2 font-bold text-zinc-800">
              <i className={`fa-solid ${s.icon} text-emerald-600`} aria-hidden /> {s.h}
            </h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-zinc-600">
              {s.body.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <section className="mt-8 rounded-2xl bg-zinc-50 px-5 py-4 text-sm text-zinc-600">
        <h2 className="font-bold text-zinc-800">문의</h2>
        <p className="mt-1.5 leading-relaxed">
          환불 관련 문의는{" "}
          <Link href="/inquiry" className="text-emerald-700 underline underline-offset-2">
            1:1 문의
          </Link>{" "}
          또는{" "}
          <a href={`mailto:${COMPANY.email}`} className="text-emerald-700 underline underline-offset-2">
            {COMPANY.email}
          </a>{" "}
          로 보내주세요. 응대 시간: {COMPANY.supportHours}
        </p>
      </section>

      <p className="mt-6 text-xs text-zinc-400">시행일: 2026년 9월 23일</p>
    </article>
  );
}
