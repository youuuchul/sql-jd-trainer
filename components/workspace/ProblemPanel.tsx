"use client";
import { useState } from "react";
import { Badge } from "@/components/ui-lab/components/badge/Badge";
import { DIFFICULTY_LABEL, SOURCE_LABEL, type Problem } from "@/lib/content/types";

const DIFF_TONE = { basic: "success", intermediate: "warning", advanced: "danger" } as const;

export function ProblemPanel({ problem, index, total }: { problem: Problem; index?: number; total?: number }) {
  const [shownHints, setShownHints] = useState(0);
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {index !== undefined && total !== undefined && (
            <span className="font-mono text-xs text-muted">
              {index + 1} / {total}
            </span>
          )}
          <Badge size="sm" tone="accent">
            {SOURCE_LABEL[problem.sourceType]}
          </Badge>
          <Badge size="sm" tone={DIFF_TONE[problem.difficulty]}>
            {DIFFICULTY_LABEL[problem.difficulty]}
          </Badge>
          {problem.format === "fix" && (
            <Badge size="sm" tone="warning">
              깨진 쿼리 고치기
            </Badge>
          )}
          {problem.timeLimitMin && <span className="text-xs text-muted">권장 {problem.timeLimitMin}분</span>}
        </div>
        <h1 className="text-lg leading-snug font-semibold tracking-tight">{problem.title}</h1>
        <p className="text-[14px] leading-relaxed text-fg/90">{problem.prompt}</p>
      </div>
      {problem.requirements.length > 0 && (
        <section>
          <h2 className="mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">요구 조건</h2>
          <ol className="list-decimal space-y-1 pl-5 text-[13px] leading-relaxed text-fg/85">
            {problem.requirements.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ol>
        </section>
      )}
      {problem.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {problem.tags.map((t) => (
            <Badge key={t} size="sm">
              {t}
            </Badge>
          ))}
        </div>
      )}
      {problem.hints.length > 0 && (
        <section className="space-y-1.5">
          {problem.hints.slice(0, shownHints).map((h, i) => (
            <p key={i} className="rounded-xl border border-line bg-surface px-3 py-2 text-[13px] leading-relaxed text-fg/85">
              <span className="mr-1.5 font-mono text-xs text-muted">힌트 {i + 1}</span>
              {h}
            </p>
          ))}
          {shownHints < problem.hints.length && (
            <button type="button" onClick={() => setShownHints((n) => n + 1)} className="text-xs text-accent hover:underline">
              힌트 보기 ({shownHints + 1}/{problem.hints.length})
            </button>
          )}
        </section>
      )}
    </div>
  );
}
