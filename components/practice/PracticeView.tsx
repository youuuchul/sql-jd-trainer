"use client";
import Link from "next/link";
import { useState, type CSSProperties } from "react";
import { CAT_CLASS, CAT_SHORT } from "@/components/ui/category";
import { Button } from "@/components/ui/Button";
import { FORMAT_ICON, Icon } from "@/components/ui/icons";
import { PathNode } from "@/components/ui/PathNode";
import { DIFFICULTY_LABEL, FORMAT_LABEL, SET_CATEGORY_LABEL, type SetCategory } from "@/lib/content/types";
import { usePath, type CategoryPath, type PathNode as PathNodeData, type PathSet, type SetPath } from "@/lib/path";

/** 시안 04 세로 경로의 좌우 흔들림(px) */
const WAVE = [0, -58, -86, -58, 0, 58, 86, 58];

const nodeMeta = (n: PathNodeData) => `${FORMAT_LABEL[n.problem.format]} · ${DIFFICULTY_LABEL[n.problem.difficulty]}${n.problem.timeLimitMin ? ` · ${n.problem.timeLimitMin}분` : ""}`;

function CategoryCard({ cat, on, onSelect }: { cat: CategoryPath; on: boolean; onSelect: () => void }) {
  const ring = on ? "shadow-[0_4px_0_color-mix(in_srgb,var(--cat)_70%,#000),0_0_0_3px_var(--color-bg),0_0_0_5.5px_var(--cat)] dark:shadow-[inset_0_0_0_2px_var(--cat)]" : "";
  const size = "flex h-[112px] w-[124px] shrink-0 flex-col rounded-[20px] p-[13px] pb-3 text-left lg:h-[104px] lg:w-auto focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent";
  if (cat.locked)
    return (
      <button type="button" onClick={onSelect} aria-pressed={on} className={`${size} ${CAT_CLASS.archive} bg-surface-2 text-muted shadow-[inset_0_0_0_1.5px_var(--color-line-2)] ${on ? "!shadow-[inset_0_0_0_2px_var(--color-line-2),0_0_0_3px_var(--color-bg),0_0_0_5.5px_var(--color-line-2)] dark:!shadow-[inset_0_0_0_2px_var(--cat)]" : ""}`}>
        <Icon name="lock" size={20} className="mb-2" />
        <b className="text-[15.5px] leading-tight font-extrabold tracking-[-0.03em]">{CAT_SHORT.archive}</b>
        <span className="mt-0.5 text-[11.5px] font-semibold opacity-80">{cat.sets.length}세트</span>
      </button>
    );
  return (
    <button type="button" onClick={onSelect} aria-pressed={on} className={`${size} ${CAT_CLASS[cat.category]} hq-catfill ${ring}`}>
      <b className="text-[15.5px] leading-tight font-extrabold tracking-[-0.03em]">{SET_CATEGORY_LABEL[cat.category]}</b>
      <span className="mt-0.5 text-[11.5px] font-semibold opacity-80">
        {cat.sets.length}세트 · {cat.total}문제
      </span>
      <span className="mt-auto h-1.5 overflow-hidden rounded-[3px] bg-white/30 dark:bg-surface-3" aria-hidden="true">
        <i className="block h-full rounded-[3px] bg-white dark:bg-[var(--cat)]" style={{ width: `${cat.total ? (cat.passed / cat.total) * 100 : 0}%` }} />
      </span>
      <em className="mt-1.5 font-mono text-[11.5px] leading-none font-bold not-italic opacity-90">
        {cat.passed} / {cat.total}
      </em>
    </button>
  );
}

function DoneBar({ category, done }: { category: SetCategory; done: SetPath[] }) {
  const passed = done.reduce((a, s) => a + s.passed, 0);
  const total = done.reduce((a, s) => a + s.total, 0);
  const range = done.length === 1 ? "1" : `1–${done.length}`;
  return (
    <div className={`${CAT_CLASS[category]} mt-1.5 flex h-11 items-center gap-2.5 rounded-[14px] bg-surface pr-3.5 pl-2.5 text-[13.5px] font-semibold text-fg-2 shadow-[inset_0_0_0_1.5px_var(--color-line)] dark:shadow-[inset_0_0_0_1px_var(--color-line)]`}>
      <span className="flex">
        {done.slice(0, 4).map((s, i) => (
          <Link
            key={s.set.id}
            href={`/sets/${s.set.id}`}
            aria-label={s.set.title}
            className={`grid h-[26px] w-[26px] place-items-center rounded-full bg-[var(--cat)] font-mono text-[11px] font-extrabold text-white shadow-[0_0_0_2px_var(--color-surface)] ${i ? "-ml-1.5" : ""} ${category === "kpi" ? "text-[#3b2a00]" : ""}`}
          >
            {i + 1}
          </Link>
        ))}
      </span>
      <span className="min-w-0 truncate">
        {CAT_SHORT[category]} {range} 완료
      </span>
      <span className="ml-auto font-mono text-[12.5px] text-muted">
        {passed} / {total}
      </span>
    </div>
  );
}

function SetUnit({ sp, number, open, onToggle }: { sp: SetPath; number: number; open: boolean; onToggle: () => void }) {
  const { set } = sp;
  return (
    <section className={`${CAT_CLASS[set.category]} mt-3`}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="hq-catfill relative block w-full rounded-[20px] px-4 pt-3.5 pb-[15px] text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
        <span className="block text-xs font-bold opacity-80">
          {CAT_SHORT[set.category]} {number}
        </span>
        <h2 className="pr-16 text-[21px] leading-tight font-extrabold tracking-[-0.03em]">{set.title.replace(/^\S+ \d+\.\s*/, "")}</h2>
        <span className="mt-[3px] block truncate pr-14 text-[12.5px] font-medium opacity-80">{set.description}</span>
        <span className="absolute top-4 right-4 rounded-[9px] bg-white/20 px-2 py-1.5 font-mono text-sm font-extrabold dark:bg-surface-3">
          {sp.passed}/{sp.total}
        </span>
      </button>
      {open && (
        <div className="mt-4">
          <ol className="flex flex-col lg:grid lg:grid-cols-[repeat(auto-fill,minmax(150px,1fr))] lg:gap-y-2">
            {sp.nodes.map((n, i) => (
              <li key={n.problem.id} className="flex flex-col items-center py-1.5 lg:py-2" style={{ "--x": `${WAVE[i % WAVE.length]}px` } as CSSProperties}>
                <div className="relative translate-x-[var(--x)] lg:translate-x-0">
                  <PathNode state={n.state} category={set.category} icon={FORMAT_ICON[n.problem.format]} size={68} href={`/problems/${n.problem.id}`} label={n.problem.title} />
                  {n.state === "cur" && (
                    <div className="absolute top-1/2 left-[calc(100%+16px)] z-10 w-max max-w-[190px] -translate-y-1/2 rounded-[14px] bg-surface px-3 pt-2.5 pb-[11px] shadow-[inset_0_0_0_1.5px_var(--color-line-2),0_3px_0_var(--color-line-2)] lg:hidden dark:shadow-[inset_0_0_0_1px_var(--color-line-2),0_8px_24px_-8px_#000]">
                      <b className="block text-sm leading-[1.35] font-bold">{n.problem.title}</b>
                      <span className="mt-[3px] block text-xs font-semibold text-muted">{nodeMeta(n)}</span>
                    </div>
                  )}
                </div>
                <p className="mt-3 hidden max-w-[150px] text-center text-[12.5px] leading-[1.4] font-semibold text-fg-2 lg:block">
                  <b className={`block font-bold ${n.state === "cur" ? "hq-catink" : "text-fg"}`}>{n.problem.title}</b>
                  {nodeMeta(n)}
                </p>
              </li>
            ))}
          </ol>
          <div className="mt-3 flex justify-center">
            <Button href={`/sets/${set.id}`} tone="ghost" size="xs">
              문제 목록
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function ArchiveList({ sets }: { sets: PathSet[] }) {
  return (
    <ul className="mt-3 space-y-3">
      {sets.map((s) => (
        <li key={s.id}>
          <Link href={`/sets/${s.id}`} className="hq-card flex items-center gap-3.5 p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
            <PathNode state="lock" category="archive" size={48} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-extrabold tracking-[-0.02em]">{s.title}</span>
              <span className="block truncate text-[12.5px] font-medium text-muted">{s.description}</span>
            </span>
            <span className="shrink-0 font-mono text-xs font-bold text-muted">{s.problemCount}문제</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** 연습 탭: 분류 카드와 선택한 분류의 세트 경로. 순서는 권장만이라 모두 열려 있고 잠김은 아카이브뿐이다 */
export function PracticeView({ sets }: { sets: PathSet[] }) {
  const { categories } = usePath(sets);
  const [picked, setPicked] = useState<SetCategory | null>(null);
  const [openSets, setOpenSets] = useState<Record<string, boolean>>({});
  const selected = categories.find((c) => c.category === picked) ?? categories.find((c) => !c.locked && c.current) ?? categories.find((c) => !c.locked) ?? categories[0];

  const leadingDone: SetPath[] = [];
  if (selected && !selected.locked) for (const s of selected.sets) if (s.state === "done") leadingDone.push(s);
  const rest = selected && !selected.locked ? selected.sets.filter((s) => !leadingDone.includes(s)) : [];
  const defaultOpen = rest.find((s) => s.state === "cur")?.set.id ?? rest[0]?.set.id;

  return (
    <div className="mx-auto w-full max-w-5xl px-5 pt-1 pb-8 lg:px-10 lg:py-8">
      <header className="flex h-[52px] items-center">
        <h1 className="text-[26px] font-extrabold tracking-[-0.035em]">연습</h1>
      </header>
      <div className="-mx-5 flex gap-2.5 overflow-x-auto px-5 pt-1 pb-3 lg:mx-0 lg:grid lg:grid-cols-5 lg:gap-3.5 lg:overflow-visible lg:px-1">
        {categories.map((c) => (
          <CategoryCard key={c.category} cat={c} on={c.category === selected?.category} onSelect={() => setPicked(c.category)} />
        ))}
      </div>
      {selected?.locked ? (
        <ArchiveList sets={selected.sets.map((s) => s.set)} />
      ) : (
        selected && (
          <div>
            {leadingDone.length > 0 && <DoneBar category={selected.category} done={leadingDone} />}
            {rest.map((s) => {
              const id = s.set.id;
              return <SetUnit key={id} sp={s} number={selected.sets.indexOf(s) + 1} open={openSets[id] ?? id === defaultOpen} onToggle={() => setOpenSets((o) => ({ ...o, [id]: !(o[id] ?? id === defaultOpen) }))} />;
            })}
          </div>
        )
      )}
    </div>
  );
}
