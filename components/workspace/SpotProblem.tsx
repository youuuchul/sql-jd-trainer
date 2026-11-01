"use client";
import { useState } from "react";
import { Button } from "@/components/ui-lab/components/button/Button";
import { Tabs } from "@/components/ui-lab/components/tabs/Tabs";
import { DIALECT_LABEL, type Dialect, type Problem } from "@/lib/content/types";
import { useProblemProgress, useProgressStore } from "@/lib/progress";
import { renderText } from "@/lib/text";
import { DialectSelector } from "./DialectSelector";
import { ResultGrid } from "./ResultGrid";
import { SqlEditor } from "./SqlEditor";
import type { EngineStatus } from "./useEngine";

export interface SpotProblemProps {
  problem: Problem;
  dialect: Dialect;
  onDialectChange: (d: Dialect) => void;
  status: EngineStatus;
  mode: "practice" | "mock";
  onGraded?: (passed: boolean) => void;
}

interface SpotGrade {
  pass: boolean;
  hit: number;
  wrong: number;
  total: number;
}

export function SpotProblem({ problem, dialect, onDialectChange, status, mode, onGraded }: SpotProblemProps) {
  const [, update] = useProblemProgress(problem.id);
  const store = useProgressStore();
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [grade, setGrade] = useState<SpotGrade | null>(null);
  // 저장소가 바뀌면(초기 적재 포함) 저장된 선택을 불러온다 (렌더 중 상태 조정 패턴).
  const [syncedStore, setSyncedStore] = useState<typeof store | null>(null);
  if (store !== syncedStore) {
    setSyncedStore(store);
    setSelected(new Set(store[problem.id]?.spotRows ?? []));
  }
  const spot = problem.spot;
  const expected = problem.expected;
  if (!spot || !expected) return null;
  const sql = spot.sql[dialect] ?? spot.sql.postgres ?? "";
  const solution = problem.solutions?.[dialect];

  const toggle = (i: number) => {
    setGrade(null);
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const submit = () => {
    const answer = new Set(spot.anomalyRows);
    const hit = [...selected].filter((i) => answer.has(i)).length;
    const wrong = selected.size - hit;
    const pass = hit === answer.size && wrong === 0;
    setGrade({ pass, hit, wrong, total: answer.size });
    update((p) => ({ attempts: p.attempts + 1, passed: p.passed || pass, spotRows: [...selected], passedAt: pass && !p.passed ? new Date().toISOString() : p.passedAt }));
    onGraded?.(pass);
  };

  const showAnswer = mode === "practice" && grade !== null;
  const highlight = showAnswer ? new Map(spot.anomalyRows.map((i) => [i, "extra" as const])) : undefined;

  return (
    <div className="flex flex-col gap-3">
      <DialectSelector value={dialect} onChange={onDialectChange} status={status} />
      <div className="min-h-[10rem] overflow-hidden rounded-xl border border-line bg-bg">
        <SqlEditor value={sql} onChange={() => {}} dialect={dialect} readOnly />
      </div>
      <div className="rounded-xl border border-line bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
          <p className="text-xs font-semibold text-muted">쿼리 결과 {spot.rows.length}행 · 잘못된 행을 고르세요</p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">{selected.size}행 선택</span>
            <Button size="sm" onClick={submit} disabled={selected.size === 0}>
              채점
            </Button>
          </div>
        </div>
        <ResultGrid columns={spot.columns} rows={spot.rows} caption="잘못된 쿼리의 결과" selected={selected} onToggle={toggle} highlight={highlight} />
      </div>
      {grade && (
        <div className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 text-sm ${grade.pass ? "border-pass/40 bg-pass/10" : "border-fail/40 bg-fail/10"}`}>
          <span className={`inline-block h-2 w-2 rounded-full ${grade.pass ? "bg-pass" : "bg-fail"}`} aria-hidden="true" />
          <span className={`font-medium ${grade.pass ? "text-pass" : "text-fail"}`}>{grade.pass ? "정답" : "오답"}</span>
          <span className="text-muted">
            이상 행 {grade.total}개 중 {grade.hit}개를 찾았고 {grade.wrong}개를 잘못 골랐습니다.
          </span>
        </div>
      )}
      {showAnswer && (
        <div className="rounded-xl border border-line bg-surface">
          <Tabs
            label="정답 보기"
            items={[
              { value: "expected", label: `올바른 결과 ${expected.rows.length}행`, content: <ResultGrid columns={expected.columns} rows={expected.rows} caption="올바른 결과" /> },
              ...(solution
                ? [
                    {
                      value: "solution",
                      label: `올바른 쿼리 · ${DIALECT_LABEL[dialect]}`,
                      content: <pre className="overflow-x-auto p-3 font-mono text-[12.5px] leading-relaxed">{solution}</pre>,
                    },
                  ]
                : []),
            ]}
          />
        </div>
      )}
      {showAnswer && problem.explanation && (
        <section className="space-y-3 rounded-xl border border-line bg-surface p-4">
          <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">해설</h2>
          {renderText(problem.explanation)}
          {problem.dialectNotes?.[dialect] && <p className="text-[12.5px] leading-relaxed text-muted">{problem.dialectNotes[dialect]}</p>}
        </section>
      )}
    </div>
  );
}
