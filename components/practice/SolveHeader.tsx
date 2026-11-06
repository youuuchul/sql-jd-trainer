"use client";
import Link from "next/link";
import { CAT_CLASS, CAT_SHORT } from "@/components/ui/category";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";
import type { SetCategory } from "@/lib/content/types";
import { useProgressStore } from "@/lib/progress";
import { splitSetTitle } from "./setTitle";

/** 문제 풀이 화면이 속한 세트 정보. 풀이 헤더의 위치·이전·다음에 쓴다 */
export interface SetNav {
  setId: string;
  setTitle: string;
  category: SetCategory;
  domain: string;
  items: { id: string; title: string }[];
  index: number;
}

export function BackButton({ href }: { href: string }) {
  return (
    <Link
      href={href}
      aria-label="세트로 돌아가기"
      className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface text-fg-2 shadow-[inset_0_0_0_1.5px_var(--color-line-2),0_2px_0_var(--color-line-2)] focus-visible:outline-2 focus-visible:outline-accent dark:shadow-[inset_0_0_0_1px_var(--color-line-2)]"
    >
      <Icon name="back" size={21} />
    </Link>
  );
}

/** 모바일 풀이 머리: 뒤로 · 위치와 제목 · 스키마 버튼 */
export function SolveTopMobile({ nav, title, onSchema, schemaOpen }: { nav?: SetNav; title: string; onSchema: () => void; schemaOpen: boolean }) {
  return (
    <div className="flex h-[58px] items-center gap-2.5 pr-3.5 pl-3">
      <BackButton href={nav ? `/sets/${nav.setId}` : "/practice"} />
      <div className="min-w-0 flex-1">
        {nav && (
          <p className={`${CAT_CLASS[nav.category]} hq-catink text-xs font-bold`}>
            {CAT_SHORT[nav.category]} · {nav.index + 1} / {nav.items.length}
          </p>
        )}
        <p className="truncate text-[16.5px] leading-[1.3] font-extrabold tracking-[-0.025em]">{title}</p>
      </div>
      <button
        type="button"
        onClick={onSchema}
        aria-label="스키마"
        aria-pressed={schemaOpen}
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1 ring-line-2 ring-inset focus-visible:outline-2 focus-visible:outline-accent ${schemaOpen ? "bg-accent-soft text-accent-ink" : "bg-surface text-fg-2"}`}
      >
        <Icon name="db" size={21} />
      </button>
    </div>
  );
}

/** 데스크톱 풀이 머리: 뒤로 · 분류와 세트 · 진행 막대 · 이전/다음 */
export function SolveTopDesktop({ nav }: { nav?: SetNav }) {
  const store = useProgressStore();
  const prev = nav && nav.index > 0 ? nav.items[nav.index - 1] : null;
  const next = nav && nav.index < nav.items.length - 1 ? nav.items[nav.index + 1] : null;
  return (
    <header className={`mb-3 flex h-11 shrink-0 items-center gap-3 ${nav ? CAT_CLASS[nav.category] : ""}`}>
      <BackButton href={nav ? `/sets/${nav.setId}` : "/practice"} />
      {nav && (
        <>
          <span className="hq-catink text-sm font-bold">
            {CAT_SHORT[nav.category]} · {splitSetTitle(nav.setTitle, nav.category).name}
          </span>
          <span className="ml-1.5 flex gap-1.5" aria-hidden="true">
            {nav.items.map((it, i) => {
              const pr = store[it.id];
              return <i key={it.id} className={`h-2 w-[26px] rounded border-0 ${pr?.passed ? "bg-[var(--cat)]" : pr?.attempts ? "bg-fail" : "bg-surface-3"} ${i === nav.index ? "ring-2 ring-fg-2/50 ring-offset-1 ring-offset-bg" : ""}`} />;
            })}
          </span>
          <span className="font-mono text-[12.5px] text-muted">
            {nav.index + 1} / {nav.items.length}
          </span>
          <span className="ml-auto flex gap-2">
            {prev ? (
              <Button href={`/problems/${prev.id}`} tone="ghost" size="xs">
                이전
              </Button>
            ) : (
              <Button tone="off" size="xs" disabled>
                이전
              </Button>
            )}
            {next ? (
              <Button href={`/problems/${next.id}`} tone="ghost" size="xs">
                다음
              </Button>
            ) : (
              <Button tone="off" size="xs" disabled>
                다음
              </Button>
            )}
          </span>
        </>
      )}
    </header>
  );
}
