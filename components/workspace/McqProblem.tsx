"use client";
import { useState } from "react";
import { Button } from "@/components/ui-lab/components/button/Button";
import type { Problem } from "@/lib/content/types";
import { useProblemProgress } from "@/lib/progress";
import { renderText } from "@/lib/text";

export function McqProblem({ problem, onGraded }: { problem: Problem; onGraded?: (passed: boolean) => void }) {
  const choices = problem.choices;
  const [progress, update] = useProblemProgress(problem.id);
  const [selected, setSelected] = useState<string[]>(progress.mcqAnswer ?? []);
  const [graded, setGraded] = useState<boolean | null>(progress.passed ? true : null);
  if (!choices) return null;

  const toggle = (key: string) => {
    setGraded(null);
    setSelected((s) => (choices.multiple ? (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]) : [key]));
  };
  const grade = () => {
    const ok = selected.length === choices.answer.length && choices.answer.every((a) => selected.includes(a));
    setGraded(ok);
    update((p) => ({ attempts: p.attempts + 1, passed: p.passed || ok, mcqAnswer: selected, passedAt: ok ? new Date().toISOString() : p.passedAt }));
    onGraded?.(ok);
  };

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {choices.options.map((o) => {
          const on = selected.includes(o.key);
          const isAnswer = graded !== null && choices.answer.includes(o.key);
          return (
            <li key={o.key}>
              <button
                type="button"
                onClick={() => toggle(o.key)}
                aria-pressed={on}
                className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-[13.5px] leading-relaxed transition-colors ${on ? "border-accent bg-accent/10" : "border-line bg-surface hover:bg-fg/5"} ${graded !== null && isAnswer ? "ring-1 ring-pass/60" : ""}`}
              >
                <span className="mt-0.5 font-mono text-xs text-muted">{o.key}</span>
                <span>{o.text}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="flex items-center gap-3">
        <Button size="sm" onClick={grade} disabled={!selected.length}>
          채점
        </Button>
        {graded === true && <span className="text-sm font-medium text-pass">정답</span>}
        {graded === false && <span className="text-sm font-medium text-fail">오답. 다시 골라 보세요.</span>}
      </div>
      {graded !== null && problem.explanation && <div className="space-y-2 rounded-xl border border-line bg-surface p-4">{renderText(problem.explanation)}</div>}
    </div>
  );
}
