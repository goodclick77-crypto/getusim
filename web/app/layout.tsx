import type { Metadata } from "next";
import "./globals.css";
import NaverAnalytics from "./NaverAnalytics";

export const metadata: Metadata = {
  metadataBase: new URL("https://getusim.com"),
  title: "GetUsim — 글로벌 SMS 인증",
  description: "포인트 충전으로 이용하는 글로벌 가상번호 SMS 인증 서비스 GetUsim",
  // 카카오톡 등 공유 미리보기: 이미지 없이 제목·설명·주소만 깔끔하게
  openGraph: {
    type: "website",
    siteName: "GetUsim",
    title: "GetUsim — 글로벌 SMS 인증",
    description: "포인트 충전으로 이용하는 글로벌 가상번호 SMS 인증 서비스",
    url: "https://getusim.com",
    locale: "ko_KR",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@1.3.9/dist/web/static/pretendard.min.css"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css"
        />
      </head>
      <body className="flex min-h-full flex-col">
        <a href="#main" className="skip-link">
          본문 바로가기
        </a>
        {children}
        <NaverAnalytics />
      </body>
    </html>
  );
}
