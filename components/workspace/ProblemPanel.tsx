"use client";
import { useState } from "react";
import { Chip } from "@/components/ui/Chip";
import { FORMAT_ICON, Icon } from "@/components/ui/icons";
import { DIFFICULTY_LABEL, FORMAT_LABEL, SOURCE_LABEL, type Problem } from "@/lib/content/types";

const DIFF_TONE = { basic: "pass", intermediate: "warn", advanced: "fail" } as const;

export function ProblemPanel({ problem }: { problem: Problem }) {
  const [shownHints, setShownHints] = useState(0);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip size="sm" tone="accent">
          {SOURCE_LABEL[problem.sourceType]}
        </Chip>
        <Chip size="sm" tone={DIFF_TONE[problem.difficulty]}>
          {DIFFICULTY_LABEL[problem.difficulty]}
        </Chip>
        <Chip size="sm">
          <Icon name={FORMAT_ICON[problem.format]} size={13} />
          {FORMAT_LABEL[problem.format]}
        </Chip>
        {problem.timeLimitMin && <span className="text-[12.5px] font-semibold text-muted">권장 {problem.timeLimitMin}분</span>}
      </div>
      <h1 className="mt-3 mb-2.5 text-[21px] leading-[1.35] font-extrabold tracking-[-0.035em]">{problem.title}</h1>
      <p className="text-[14.5px] leading-[1.65] font-medium text-fg-2">{problem.prompt}</p>
      {problem.requirements.length > 0 && (
        <section className="mt-[18px]">
          <h2 className="text-[12.5px] font-bold tracking-[0.01em] text-muted">요구 조건</h2>
          <ol className="mt-2 ml-[18px] grid list-decimal gap-1.5 text-[13.5px] leading-[1.62] text-fg-2 marker:font-mono marker:text-xs marker:text-muted">
            {problem.requirements.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ol>
        </section>
      )}
      {problem.tags.length > 0 && (
        <div className="mt-3.5 flex flex-wrap gap-1.5">
          {problem.tags.map((t) => (
            <span key={t} className="inline-flex h-6 items-center rounded-[7px] bg-surface-2 px-2 text-xs font-semibold whitespace-nowrap text-fg-2">
              {t}
            </span>
          ))}
        </div>
      )}
      {problem.hints.length > 0 && (
        <section className="mt-4 space-y-2">
          {problem.hints.slice(0, shownHints).map((h, i) => (
            <p key={i} className="rounded-[14px] bg-note-bg px-3.5 py-2.5 text-[13px] leading-[1.6] font-medium text-note-ink ring-1 ring-note-line ring-inset">
              <span className="mr-1.5 font-mono text-xs opacity-70">힌트 {i + 1}</span>
              {h}
            </p>
          ))}
          {shownHints < problem.hints.length && (
            <button type="button" onClick={() => setShownHints((n) => n + 1)} className="inline-flex items-center gap-1.5 text-[13.5px] font-bold text-accent-ink hover:underline">
              <Icon name="bulb" size={17} />
              힌트 보기 ({shownHints + 1}/{problem.hints.length})
            </button>
          )}
        </section>
      )}
    </div>
  );
}
