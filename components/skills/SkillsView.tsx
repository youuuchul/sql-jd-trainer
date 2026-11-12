"use client";
import Link from "next/link";
import { Chip } from "@/components/ui/Chip";
import { SKILL_SHELVES, SKILL_SHELF_LABEL } from "@/lib/content/types";
import { useNow } from "@/lib/daily/store";
import { useProgressStore } from "@/lib/progress";
import { useSkillStore, type SkillView } from "@/lib/skills";
import { SHELF_CLASS } from "./shelf";

/** 유형 탭: 선반(패턴·함수·기초 문법)별 유형 타일. 문제가 없는 유형은 그리지 않는다 */
export function SkillsView({ skills }: { skills: SkillView[] }) {
  const progress = useProgressStore();
  const reviews = useSkillStore();
  const [now] = useNow();
  return (
    <div className="mx-auto w-full max-w-[560px] px-5 pt-1 pb-8 lg:max-w-[1040px] lg:px-10 lg:pt-6">
      <header className="flex h-12 items-center">
        <h1 className="text-[19px] font-extrabold tracking-[-0.03em] lg:text-[24px]">유형</h1>
      </header>
      {SKILL_SHELVES.map((shelf) => {
        const items = skills.filter((s) => s.shelf === shelf && s.problems.length > 0);
        if (!items.length) return null;
        return (
          <section key={shelf} className={`${SHELF_CLASS[shelf]} mt-3 mb-6`} aria-labelledby={`shelf-${shelf}`}>
            <h2 id={`shelf-${shelf}`} className="hq-catink mx-0.5 mb-2.5 text-[13px] font-extrabold tracking-[0.02em]">
              {SKILL_SHELF_LABEL[shelf]}
            </h2>
            <ul className="grid grid-cols-[minmax(0,1fr)] gap-2.5 lg:grid-cols-3">
              {items.map((s) => {
                const passed = s.problems.filter((p) => progress[p.id]?.passed).length;
                const due = now > 0 && reviews[s.id] !== undefined && reviews[s.id].due <= now;
                return (
                  <li key={s.id}>
                    <Link href={`/skills/${s.id}`} className="hq-card flex h-full items-center gap-3 px-3.5 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                      <i aria-hidden="true" className="h-9 w-1.5 shrink-0 rounded-full bg-[var(--cat)]" />
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate text-[15px] font-extrabold tracking-[-0.02em] ${shelf === "function" ? "font-mono text-[14px] tracking-normal" : ""}`}>{s.title}</span>
                        <span className="block truncate text-[12.5px] font-medium text-muted">{s.summary}</span>
                      </span>
                      {due && (
                        <Chip tone="flame" size="sm">
                          복습
                        </Chip>
                      )}
                      <span className="shrink-0 text-[12.5px] font-bold text-muted tabular-nums" aria-label={`${s.problems.length}문제 중 ${passed}문제 통과`}>
                        {passed} / {s.problems.length}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
