"use client";

/**
 * 회원 포인트 조정 제출 버튼.
 * 제출 전 같은 폼의 amount 입력값을 읽어, 지급/차감 방향과 금액을 확인창으로 보여준다.
 * (부호·자릿수 실수 방지)
 */
export default function PointApplyButton({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        const form = e.currentTarget.form;
        const input = form?.elements.namedItem("amount") as
          | HTMLInputElement
          | null;
        const n = Number(input?.value);
        if (!n || isNaN(n)) {
          e.preventDefault();
          alert("조정할 포인트를 입력하세요. (지급은 양수, 차감은 음수)");
          return;
        }
        const abs = Math.abs(n).toLocaleString("ko-KR");
        const msg =
          n > 0
            ? `${abs}P 를 지급(적립)할까요?`
            : `${abs}P 를 차감할까요?`;
        if (!confirm(msg)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
