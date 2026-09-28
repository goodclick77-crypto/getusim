"use client";

import { usePathname } from "next/navigation";

/**
 * 상단 고정 공지 바(얇은 마퀴).
 *
 * - 높이 28px(h-7) 고정. 각 레이아웃의 sticky 헤더가 `top-7` 로 내려가 있어 겹치지 않는다.
 *   높이를 바꾸면 헤더들의 `top-7` 도 같이 바꿔야 한다.
 * - z-30 인 이유: 모바일 메뉴 오버레이가 헤더(z-40) 안에 있어서, 배너가 z-40 이상이면
 *   메뉴가 열렸을 때 배너가 그 위를 덮는다.
 * - 관리자 화면은 고객 안내가 필요 없고 헤더도 어두운 톤이라 숨긴다.
 */
const MESSAGE =
  "⚠ 서버 오류로 입금이 지연될 수 있습니다 · 입금계좌를 반드시 확인 후 입금해 주세요";

// 화면보다 좁으면 마퀴가 끊겨 보이므로 4벌 깔고 절반(2벌)만큼 흘린다.
const COPIES = [0, 1, 2, 3];

export default function TopNoticeBar() {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) return null;

  return (
    <div
      role="status"
      className="sticky top-0 z-30 h-7 overflow-hidden border-b border-amber-500/30 bg-amber-400/95 text-amber-950"
    >
      <div className="marquee h-full items-center">
        {COPIES.map((i) => (
          <span
            key={i}
            className="whitespace-nowrap px-8 text-[11px] font-semibold tracking-tight"
            // 스크린리더가 같은 문장을 4번 읽지 않도록 사본은 숨긴다.
            aria-hidden={i > 0}
          >
            {MESSAGE}
          </span>
        ))}
      </div>
    </div>
  );
}
