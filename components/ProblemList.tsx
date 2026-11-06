"use client";
import Link from "next/link";
import { Chip } from "@/components/ui/Chip";
import { FORMAT_ICON, Icon } from "@/components/ui/icons";
import { DIFFICULTY_LABEL, FORMAT_LABEL, SOURCE_LABEL, type Problem } from "@/lib/content/types";
import { useProgressStore } from "@/lib/progress";

type ListItem = Pick<Problem, "id" | "title" | "difficulty" | "format" | "sourceType" | "tags"> & { timeLimitMin?: number | null };

const DIFF_TONE = { basic: "pass", intermediate: "warn", advanced: "fail" } as const;

/** reasons: 문제별로 태그 대신 보여줄 추천 근거 */
export function ProblemList({ problems, reasons }: { problems: ListItem[]; reasons?: Record<string, string[]> }) {
  const store = useProgressStore();
  return (
    <ol className="space-y-2.5">
      {problems.map((p, i) => {
        const pr = store[p.id];
        const passed = pr?.passed;
        return (
          <li key={p.id}>
            <Link href={`/problems/${p.id}`} className="hq-card flat flex items-center gap-3.5 px-3.5 py-3 transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${passed ? "bg-pass-soft text-pass-ink" : pr?.attempts ? "bg-fail-soft text-fail-ink" : "bg-surface-2 text-fg-2"}`}>
                <Icon name={passed ? "check" : FORMAT_ICON[p.format]} size={18} strokeWidth={passed ? 2.6 : 1.85} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14.5px] font-bold">
                  <span className="mr-2 font-mono text-xs font-semibold text-muted">{i + 1}</span>
                  {p.title}
                </p>
                <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs font-medium text-muted">
                  <span>{SOURCE_LABEL[p.sourceType]}</span>
                  <span>{FORMAT_LABEL[p.format]}</span>
                  {p.timeLimitMin ? <span>권장 {p.timeLimitMin}분</span> : null}
                  {(reasons?.[p.id] ?? p.tags.slice(0, 3)).map((t) => (
                    <span key={t} className={reasons ? "text-accent-ink" : undefined}>
                      {t}
                    </span>
                  ))}
                </p>
              </div>
              <Chip size="sm" tone={DIFF_TONE[p.difficulty]}>
                {DIFFICULTY_LABEL[p.difficulty]}
              </Chip>
              {passed ? (
                <Chip size="sm" tone="pass">
                  통과
                </Chip>
              ) : pr?.attempts ? (
                <Chip size="sm" tone="fail">
                  미통과
                </Chip>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
