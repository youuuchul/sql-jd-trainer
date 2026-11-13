"use client";
import Link from "next/link";
import { CodeBlock } from "@/components/practice/Explanation";
import { BackButton } from "@/components/practice/SolveHeader";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { FORMAT_ICON, Icon } from "@/components/ui/icons";
import { DIALECT_LABEL, DIFFICULTY_LABEL, FORMAT_LABEL, SKILL_SHELF_LABEL, UI_DIALECTS, type Difficulty, type SyntaxRef } from "@/lib/content/types";
import { useNow } from "@/lib/daily/store";
import { useProgressStore } from "@/lib/progress";
import { nextInSkill, problemState, skillProblemHref, useSkillStore, type ProblemState, type SkillView } from "@/lib/skills";
import { SHELF_CLASS } from "./shelf";

const LEVELS: Difficulty[] = ["basic", "intermediate", "advanced"];
const STATE_CHIP: Record<ProblemState, { tone: "fail" | "neutral" | "pass"; label: string }> = {
  fail: { tone: "fail", label: "미통과" },
  todo: { tone: "neutral", label: "안 품" },
  pass: { tone: "pass", label: "통과" },
};

const dateLabel = (ms: number) => new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric" }).format(ms);

/** 유형 상세: 요약, 문법 형태, 다음에 풀 문제, 난이도별 문제 목록 */
export function SkillDetail({ skill, syntax }: { skill: SkillView; syntax: SyntaxRef[] }) {
  const progress = useProgressStore();
  const review = useSkillStore()[skill.id];
  const [now] = useNow();
  const next = nextInSkill(skill.problems, progress);
  const passed = skill.problems.filter((p) => progress[p.id]?.passed).length;
  const started = skill.problems.some((p) => progress[p.id]);
  const due = now > 0 && review !== undefined && review.due <= now;
  const forms = syntax.flatMap((s) => s.forms.filter((f) => f.dialect === "common" || UI_DIALECTS.includes(f.dialect)).map((f) => ({ ...f, key: `${s.id}:${f.dialect}:${f.code}` })));
  return (
    <div className={`${SHELF_CLASS[skill.shelf]} mx-auto w-full max-w-3xl px-5 pt-3 pb-8 lg:px-10 lg:py-8`}>
      <div className="flex items-center gap-3">
        <BackButton href="/skills" />
        <span className="hq-catink text-sm font-bold">{SKILL_SHELF_LABEL[skill.shelf]}</span>
      </div>
      <div className="hq-catfill mt-4 rounded-[20px] px-[18px] pt-4 pb-[18px]">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-xs font-bold opacity-85 tabular-nums">
            {passed} / {skill.problems.length}문제{skill.cardCount > 0 ? ` · 카드 ${skill.cardCount}장` : ""}
          </span>
          {now > 0 && review && <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-bold">{due ? "복습할 때" : `다음 복습 ${dateLabel(review.due)}`}</span>}
        </div>
        <h1 className="mt-2 text-2xl leading-tight font-extrabold tracking-[-0.03em]">{skill.title}</h1>
        <p className="mt-1.5 text-[14px] leading-[1.55] font-medium opacity-85">{skill.summary}</p>
      </div>
      {forms.length > 0 && (
        <div className="mt-4 grid gap-2.5">
          {forms.map((f) => (
            <CodeBlock key={f.key} title={f.dialect === "common" ? "문법" : DIALECT_LABEL[f.dialect]} code={f.code} />
          ))}
        </div>
      )}
      {next && (
        <div className="mt-4">
          <Button href={skillProblemHref(skill.id, next, progress)} full>
            {due ? "복습하기" : started ? "이어서 풀기" : "시작하기"}
          </Button>
        </div>
      )}
      {skill.cardCount > 0 && (
        <div className="mt-2.5">
          <Button href={`/skills/${skill.id}/cards`} tone="ghost" full>
            카드 {skill.cardCount}장 풀기
          </Button>
        </div>
      )}
      {LEVELS.map((level) => {
        const items = skill.problems.filter((p) => p.difficulty === level);
        if (!items.length) return null;
        return (
          <section key={level} className="mt-6" aria-labelledby={`level-${level}`}>
            <h2 id={`level-${level}`} className="mx-0.5 mb-2.5 text-[15px] font-extrabold tracking-[-0.02em]">
              {DIFFICULTY_LABEL[level]}
              <span className="ml-1.5 text-[13px] font-bold text-muted tabular-nums">{items.length}</span>
            </h2>
            <ol className="space-y-2.5">
              {items.map((p) => {
                const state = problemState(progress[p.id]);
                return (
                  <li key={p.id}>
                    <Link href={`/problems/${p.id}?skill=${skill.id}`} className="hq-card flat flex items-center gap-3.5 px-3.5 py-3 transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${state === "pass" ? "bg-pass-soft text-pass-ink" : state === "fail" ? "bg-fail-soft text-fail-ink" : "bg-surface-2 text-fg-2"}`}>
                        <Icon name={state === "pass" ? "check" : FORMAT_ICON[p.format]} size={18} strokeWidth={state === "pass" ? 2.6 : 1.85} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14.5px] font-bold">{p.title}</span>
                        <span className="mt-0.5 block truncate text-xs font-medium text-muted">
                          {FORMAT_LABEL[p.format]}
                          {p.timeLimitMin ? ` · 권장 ${p.timeLimitMin}분` : ""}
                        </span>
                      </span>
                      <Chip tone={STATE_CHIP[state].tone} size="sm">
                        {STATE_CHIP[state].label}
                      </Chip>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
