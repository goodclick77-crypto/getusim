"use client";

/**
 * 서버 액션 form 안에서 사용하는 제출 버튼.
 * 클릭 시 확인 다이얼로그를 띄우고, 취소하면 제출을 막는다.
 */
export default function ConfirmButton({
  message,
  className,
  title,
  children,
}: {
  message: string;
  className?: string;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      title={title}
      className={className}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
