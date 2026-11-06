"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Explanation } from "@/components/practice/Explanation";
import { Icon } from "@/components/ui/icons";
import type { Problem } from "@/lib/content/types";
import { useProblemProgress } from "@/lib/progress";
import { Verdict } from "./GradeBanner";

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
          const wrong = graded === false && on && !isAnswer;
          return (
            <li key={o.key}>
              <button
                type="button"
                onClick={() => toggle(o.key)}
                aria-pressed={on}
                className={`flex w-full items-start gap-3 rounded-2xl px-4 py-3.5 text-left text-[14px] leading-[1.55] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
                  wrong ? "bg-fail-soft ring-2 ring-fail ring-inset" : isAnswer ? "bg-pass-soft ring-2 ring-pass ring-inset" : on ? "bg-accent-soft ring-2 ring-accent ring-inset" : "bg-surface ring-[1.5px] ring-line-2 ring-inset hover:bg-surface-2"
                }`}
              >
                <span className={`mt-px grid h-6 w-6 shrink-0 place-items-center rounded-lg font-mono text-xs font-bold ${on ? "bg-accent text-on-accent" : "bg-surface-2 text-muted"}`}>{o.key}</span>
                <span className="min-w-0 flex-1">{o.text}</span>
                {isAnswer && <Icon name="check" size={18} strokeWidth={2.6} className="mt-0.5 shrink-0 text-pass" />}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" onClick={grade} disabled={!selected.length}>
          채점
        </Button>
        {graded !== null && <Verdict pass={graded}>{graded ? null : "다시 골라 보세요."}</Verdict>}
      </div>
      {graded !== null && problem.explanation && <Explanation text={problem.explanation} />}
    </div>
  );
}
