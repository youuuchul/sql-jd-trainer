"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { SeleckyMark } from "@/components/selecky/SeleckyMark";
import { Icon, type IconName } from "@/components/ui/icons";
import { SettingsBox } from "./SettingsBox";
import { useTabBarHidden } from "./tabbar";

type NavKey = "today" | "practice" | "jd";
const NAV: { key: NavKey; href: string; label: string; icon: IconName }[] = [
  { key: "today", href: "/", label: "오늘", icon: "today" },
  { key: "practice", href: "/practice", label: "연습", icon: "practice" },
  { key: "jd", href: "/jd", label: "공고", icon: "jd" },
];

const activeOf = (path: string): NavKey | null => {
  if (path === "/" || path.startsWith("/daily")) return "today";
  if (path.startsWith("/jd") || path === "/mock/jd") return "jd";
  if (path.startsWith("/practice") || path.startsWith("/sets/") || path.startsWith("/problems/") || path.startsWith("/mock/")) return "practice";
  return null;
};

/** 문제 풀이·모의 시험: 데스크톱은 아이콘 레일, 모바일은 아래 탭 없음 */
const isFocus = (path: string) => path.startsWith("/problems/") || path.startsWith("/mock/");

function Sidebar({ rail, active }: { rail: boolean; active: NavKey | null }) {
  return (
    <aside className={`sticky top-[env(safe-area-inset-top)] z-20 hidden h-[calc(100dvh-env(safe-area-inset-top))] flex-col gap-1 bg-side-bg shadow-[1px_0_0_var(--color-line)] lg:flex ${rail ? "items-center px-3 py-5" : "px-3.5 pt-[22px] pb-5"}`}>
      <Link href="/" aria-label="하루쿼리" className={`flex items-center gap-2.5 ${rail ? "pt-0.5 pb-[18px]" : "px-2.5 pt-0.5 pb-[22px]"}`}>
        <SeleckyMark size={28} />
        {!rail && (
          <span className="grid text-base leading-[1.15] font-extrabold tracking-[-0.02em]">
            하루쿼리
            <small className="text-[11px] font-semibold tracking-normal text-muted">HaruQuery</small>
          </span>
        )}
      </Link>
      <nav aria-label="주 메뉴" className="contents">
        {NAV.map((n) => {
          const on = n.key === active;
          return (
            <Link
              key={n.key}
              href={n.href}
              aria-current={on ? "page" : undefined}
              aria-label={rail ? n.label : undefined}
              title={rail ? n.label : undefined}
              className={`flex h-11 items-center rounded-xl text-[15px] font-semibold transition-colors ${rail ? "w-12 justify-center" : "gap-3 px-3"} ${on ? "bg-accent-soft text-accent-ink" : "text-fg-2 hover:bg-surface-2"}`}
            >
              <Icon name={n.icon} size={22} className={on ? "" : "text-muted"} />
              {!rail && n.label}
            </Link>
          );
        })}
      </nav>
      {rail ? (
        <>
          <button type="button" popoverTarget="hq-settings" aria-label="설정" title="설정" className="mt-auto flex h-11 w-12 items-center justify-center rounded-xl text-muted hover:bg-surface-2">
            <Icon name="gear" size={22} />
          </button>
          <div id="hq-settings" popover="auto" className="inset-auto bottom-5 left-[84px] m-0 w-56 rounded-2xl bg-transparent p-0 text-fg shadow-[0_12px_32px_-12px_rgb(0_0_0/0.35)]">
            <SettingsBox />
          </div>
        </>
      ) : (
        <SettingsBox className="mt-auto" />
      )}
    </aside>
  );
}

function TabBar({ active }: { active: NavKey | null }) {
  return (
    <nav aria-label="주 메뉴" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 bg-tab-bg pt-2 pb-[max(env(safe-area-inset-bottom),12px)] shadow-[0_-1px_0_var(--color-line)] backdrop-blur-md lg:hidden">
      {NAV.map((n) => {
        const on = n.key === active;
        return (
          <Link key={n.key} href={n.href} aria-current={on ? "page" : undefined} className={`grid justify-items-center gap-[3px] text-[11px] font-semibold ${on ? "text-accent" : "text-muted"}`}>
            <Icon name={n.icon} size={26} strokeWidth={on ? 2.2 : 1.85} />
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * 앱 셸. 데스크톱(1024px 이상)은 왼쪽 사이드바(풀이 화면은 아이콘 레일), 모바일은 아래 탭 3개.
 * 아래 탭이 보이면 main 아래에 탭 높이만큼 여백을 둔다.
 * viewport-fit=cover 라 위·좌우 safe-area 여백은 여기서 한 번 두고, 상태 표시줄 뒤는 바탕색 띠로 가린다.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const focus = isFocus(path);
  const hidden = useTabBarHidden();
  const tabs = !focus && !hidden;
  return (
    <div className={`min-h-dvh pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)] lg:grid ${focus ? "lg:grid-cols-[72px_minmax(0,1fr)]" : "lg:grid-cols-[236px_minmax(0,1fr)]"}`}>
      <Sidebar rail={focus} active={activeOf(path)} />
      <main className={`flex min-h-[calc(100dvh-env(safe-area-inset-top))] min-w-0 flex-col ${tabs ? "pb-[calc(68px+max(env(safe-area-inset-bottom),12px))] lg:pb-0" : ""}`}>{children}</main>
      {tabs && <TabBar active={activeOf(path)} />}
      <div aria-hidden="true" className="fixed inset-x-0 top-0 z-[60] h-[env(safe-area-inset-top)] bg-bg" />
    </div>
  );
}
