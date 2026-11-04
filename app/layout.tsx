import type { Metadata, Viewport } from "next";
import { JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import { RegisterServiceWorker } from "@/components/RegisterServiceWorker";
import "./globals.css";

const mono = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"], weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: "SQL JD Trainer",
  description: "데이터 분석가 라이브 쿼리 테스트 대비 SQL 연습",
  appleWebApp: { capable: true, title: "SQL 카드", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = { themeColor: "#111111" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${mono.variable} h-full`} style={{ ["--font-mono" as string]: "var(--font-jetbrains), ui-monospace, monospace" }}>
      <head>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" />
      </head>
      <body className="flex min-h-full flex-col">
        <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between gap-3 px-4 sm:px-5">
            <Link href="/" aria-label="SQL JD Trainer" className="flex shrink-0 items-center gap-2 text-[15px] font-semibold tracking-tight">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-accent" aria-hidden="true" />
              <span className="hidden sm:inline">SQL JD Trainer</span>
            </Link>
            <nav className="flex items-center gap-0.5 overflow-x-auto text-[13px] whitespace-nowrap text-muted sm:gap-1 sm:text-sm [&>a]:px-2 sm:[&>a]:px-3">
              <Link href="/daily" className="rounded-lg px-3 py-1.5 hover:bg-fg/10 hover:text-fg">
                오늘의 카드
              </Link>
              <Link href="/" className="rounded-lg px-3 py-1.5 hover:bg-fg/10 hover:text-fg">
                문제 세트
              </Link>
              <Link href="/mock/archive-mock" className="rounded-lg px-3 py-1.5 hover:bg-fg/10 hover:text-fg">
                모의 시험
              </Link>
              <Link href="/jd" className="rounded-lg px-3 py-1.5 hover:bg-fg/10 hover:text-fg">
                공고 분석
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex flex-1 flex-col">{children}</main>
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
