import { Inter } from "next/font/google";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });

export const metadata = {
  title: { default: "멘토링 예약", template: "%s · 멘토링 예약" },
  description: "지역 특화 프로젝트를 위한 1:1 멘토링 예약",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f7f7f8",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko" className={inter.variable}>
      <head>
        {/* Pretendard covers Korean glyphs; Inter covers Latin and digits. */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="min-h-dvh">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
