"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

declare global {
  interface Window {
    wcs_add?: Record<string, string>;
    wcs?: unknown;
    wcs_do?: () => void;
  }
}

// 네이버 애널리틱스 계정 ID
const WA = "17768ac3ae3c3e0";

// 현재 페이지를 웹로그로 집계한다. wcslog.js 로드 전이면 조용히 넘어간다.
function trackPageView() {
  if (typeof window === "undefined" || !window.wcs) return;
  if (!window.wcs_add) window.wcs_add = {};
  window.wcs_add["wa"] = WA;
  window.wcs_do?.();
}

// 경로/쿼리 변화를 감지해 클라이언트 라우팅마다 조회를 집계한다.
// useSearchParams는 Suspense 경계가 필요하므로 별도 컴포넌트로 분리한다.
function PageViewTracker({ ready }: { ready: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!ready) return;
    trackPageView();
  }, [ready, pathname, searchParams]);

  return null;
}

// 네이버 애널리틱스(웹로그 분석)
// wcslog.js 로드가 끝난 뒤부터 첫 조회 및 이후 라우팅 조회를 집계한다.
export default function NaverAnalytics() {
  const [ready, setReady] = useState(false);

  return (
    <>
      <Script
        id="naver-wcslog"
        src="//wcs.pstatic.net/wcslog.js"
        strategy="afterInteractive"
        onLoad={() => setReady(true)}
      />
      <Suspense fallback={null}>
        <PageViewTracker ready={ready} />
      </Suspense>
    </>
  );
}
