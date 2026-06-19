import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GetUsim — 글로벌 SMS 인증",
  description:
    "포인트 충전으로 이용하는 글로벌 가상번호 SMS 인증 서비스 GetUsim",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900">
        {children}
      </body>
    </html>
  );
}
