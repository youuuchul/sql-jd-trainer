import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const mono = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"], weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: "SQL JD Trainer",
  description: "데이터 분석가 라이브 쿼리 테스트 대비 SQL 연습",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${mono.variable} h-full`} style={{ ["--font-mono" as string]: "var(--font-jetbrains), ui-monospace, monospace" }}>
      <head>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" />
      </head>
      <body className="flex min-h-full flex-col">
        <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between px-5">
            <Link href="/" className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-accent" aria-hidden="true" />
              SQL JD Trainer
            </Link>
            <nav className="flex items-center gap-1 text-sm text-muted">
              <Link href="/" className="rounded-lg px-3 py-1.5 hover:bg-fg/10 hover:text-fg">
                문제 세트
              </Link>
              <Link href="/mock/archive-mock" className="rounded-lg px-3 py-1.5 hover:bg-fg/10 hover:text-fg">
                모의 시험
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex flex-1 flex-col">{children}</main>
      </body>
    </html>
  );
}
