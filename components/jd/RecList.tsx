"use client";
import Link from "next/link";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/icons";
import { DIFFICULTY_LABEL, SOURCE_LABEL } from "@/lib/content/types";
import type { Recommendation } from "@/lib/jd/match";
import { JD_MOCK_MAX_PROBLEMS } from "@/lib/jd/mock-set";
import { useProgressStore } from "@/lib/progress";

const DIFF_TEXT = { basic: "text-pass-ink", intermediate: "text-warn", advanced: "text-fail-ink" } as const;

/** 추천 문제 목록. 앞 JD_MOCK_MAX_PROBLEMS 개가 모의 시험 범위다. */
export function RecList({ recs, minutes }: { recs: Recommendation[]; minutes: Record<string, number | null> }) {
  const store = useProgressStore();
  const inExam = Math.min(JD_MOCK_MAX_PROBLEMS, recs.length);
  return (
    <div className="hq-card overflow-hidden">
      <div className="flex items-center gap-2 bg-accent-soft px-4 py-3 text-[14px] font-bold text-accent-ink lg:hidden">
        <Icon name="timer" size={18} />
        모의 시험 범위
        <span className="ml-auto">{`1–${inExam}`}</span>
      </div>
      <ol>
        {recs.map(({ problem: p, reasons }, i) => {
          const inRange = i < JD_MOCK_MAX_PROBLEMS;
          const min = minutes[p.id];
          return (
            <li key={p.id} className="border-t border-line first:border-t-0 lg:first:border-t-0">
              <Link href={`/problems/${p.id}`} className={`flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-surface-2 ${inRange ? "bg-accent-soft/40" : ""}`}>
                <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-[14px] font-extrabold ${inRange ? "bg-accent text-on-accent" : "bg-surface-3 text-muted"}`}>{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-bold text-fg">{p.title}</span>
                  <span className="mt-0.5 block truncate text-[13px] text-muted">
                    {SOURCE_LABEL[p.sourceType]} · <span className={`font-semibold ${DIFF_TEXT[p.difficulty]}`}>{DIFFICULTY_LABEL[p.difficulty]}</span> · {reasons.join(", ")}
                  </span>
                </span>
                {store[p.id]?.passed && (
                  <Chip tone="pass" size="sm">
                    통과
                  </Chip>
                )}
                <span className="shrink-0 text-[13.5px] font-semibold text-muted">{min ?? 10}분</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
