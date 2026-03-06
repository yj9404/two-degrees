import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TwoDegrees 💑 | 소개팅 풀 매칭 서비스",
  description: "당신과 두 다리 건너 만나는 인연. 지인의 소개로 신뢰할 수 있는 소개팅 풀 매칭 서비스입니다.",
  openGraph: {
    title: "TwoDegrees 💑 | 소개팅 풀 매칭",
    description: "당신과 두 다리 건너 만나는 인연. 지인의 소개로 신뢰할 수 있는 소개팅 풀 매칭 서비스입니다.",
    type: "website",
    locale: "ko_KR",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "TwoDegrees 소개팅 풀 매칭 서비스",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "TwoDegrees 💑 | 소개팅 풀 매칭",
    description: "당신과 두 다리 건너 만나는 인연.",
    images: ["/opengraph-image.png"],
  },
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased flex flex-col min-h-screen`}
      >
        <div className="flex-1">
          {children}
        </div>
        {/* 서비스 공통 최하단 버전 표시 */}
        <footer className="py-6 text-center text-xs text-slate-400 bg-slate-50">
          TwoDegrees v0.0.2
        </footer>
      </body>
    </html>
  );
}
