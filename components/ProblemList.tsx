"use client";
import Link from "next/link";
import { Badge } from "@/components/ui-lab/components/badge/Badge";
import { DIFFICULTY_LABEL, SOURCE_LABEL, type Problem } from "@/lib/content/types";
import { useProgressStore } from "@/lib/progress";

const DIFF_TONE = { basic: "success", intermediate: "warning", advanced: "danger" } as const;

export function ProblemList({ problems }: { problems: Problem[] }) {
  const store = useProgressStore();
  return (
    <ol className="divide-y divide-line rounded-card border border-line bg-surface">
      {problems.map((p, i) => {
        const pr = store[p.id];
        return (
          <li key={p.id}>
            <Link href={`/problems/${p.id}`} className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-fg/5">
              <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md font-mono text-xs ${pr?.passed ? "bg-pass/20 text-pass" : pr?.attempts ? "bg-fail/20 text-fail" : "bg-fg/10 text-muted"}`}>{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium">{p.title}</p>
                <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted">
                  <span>{SOURCE_LABEL[p.sourceType]}</span>
                  {p.tags.slice(0, 3).map((t) => (
                    <span key={t}>{t}</span>
                  ))}
                </p>
              </div>
              <Badge size="sm" tone={DIFF_TONE[p.difficulty]}>
                {DIFFICULTY_LABEL[p.difficulty]}
              </Badge>
              {pr?.passed && (
                <Badge size="sm" tone="success">
                  통과
                </Badge>
              )}
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
