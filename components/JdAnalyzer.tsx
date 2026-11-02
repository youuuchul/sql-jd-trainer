"use client";
import { useState, useSyncExternalStore } from "react";
import { ProblemList } from "@/components/ProblemList";
import { Badge } from "@/components/ui-lab/components/badge/Badge";
import { Button } from "@/components/ui-lab/components/button/Button";
import { analyzeJd, recommendProblems, type Competency, type CompetencyMatch, type ProblemSummary } from "@/lib/jd/match";

const KEY = "sjt:jd:v1";
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const readSaved = () => window.localStorage.getItem(KEY) ?? "";

/** 마지막으로 분석한 공고 본문. 서버 렌더는 빈 값, 클라이언트에서 저장값으로 맞춘다. */
const useSavedJd = () => {
  const saved = useSyncExternalStore(subscribe, readSaved, () => "");
  const save = (text: string) => {
    window.localStorage.setItem(KEY, text);
    listeners.forEach((l) => l());
  };
  return [saved, save] as const;
};

export function JdAnalyzer({ competencies, problems }: { competencies: Competency[]; problems: ProblemSummary[] }) {
  const [saved, save] = useSavedJd();
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? saved;
  const matches: CompetencyMatch[] | null = saved ? analyzeJd(saved, competencies) : null;

  const analyze = () => {
    save(text);
    setDraft(null);
  };

  const recs = matches ? recommendProblems(matches, problems) : [];
  const reasons = Object.fromEntries(recs.map((r) => [r.problem.id, r.reasons]));

  return (
    <div className="mt-6">
      <textarea
        aria-label="채용 공고"
        value={text}
        onChange={(e) => setDraft(e.target.value)}
        rows={10}
        placeholder="담당 업무, 자격 요건, 우대 사항"
        className="w-full resize-y rounded-card border border-line bg-surface p-4 text-[13.5px] leading-relaxed outline-none focus:border-accent"
      />
      <div className="mt-3 flex items-center gap-3">
        <Button onClick={analyze} disabled={!text.trim()}>
          분석
        </Button>
        {matches && (
          <span className="text-xs text-muted">
            역량 {matches.length}개, 추천 {recs.length}문제
          </span>
        )}
      </div>
      {matches && (
        <section className="mt-8">
          <h2 className="text-base font-semibold">요구 역량</h2>
          {matches.length === 0 ? (
            <p className="mt-2 text-[13.5px] text-fg/75">공고에서 SQL 역량 키워드를 찾지 못했습니다.</p>
          ) : (
            <ul className="mt-3 flex flex-wrap gap-2">
              {matches.map(({ competency, matched }) => (
                <li key={competency.id} className="flex items-center gap-1.5 rounded-full border border-line bg-surface py-1 pr-3 pl-1">
                  <Badge size="sm" tone="accent">
                    {competency.label}
                  </Badge>
                  <span className="text-[11.5px] text-muted">{matched.join(", ")}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {recs.length > 0 && (
        <section className="mt-8">
          <h2 className="text-base font-semibold">추천 문제</h2>
          <div className="mt-3">
            <ProblemList problems={recs.map((r) => r.problem)} reasons={reasons} />
          </div>
        </section>
      )}
    </div>
  );
}
