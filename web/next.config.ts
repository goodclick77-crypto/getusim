import type { NextConfig } from "next";

// 보안 헤더 (전 경로 공통)
//   · 다른 사이트가 iframe 으로 우리 페이지를 끼워 클릭을 유도하는 공격(클릭재킹) 차단
//   · 브라우저의 콘텐츠 타입 추측 금지, HTTPS 강제, 외부로 넘기는 주소 정보 최소화
// 전체 CSP는 외부 스크립트(네이버 분석, 아이콘 CDN, 보안문자) 호환 확인 전이라 frame-ancestors 만 건다.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
