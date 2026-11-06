"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Explanation } from "@/components/practice/Explanation";
import { UTabs } from "@/components/practice/UTabs";
import { DIALECT_LABEL, type Cell, type Dialect, type Problem } from "@/lib/content/types";
import { QueryError, type QueryResult } from "@/lib/engine";
import { compareResult, type CompareResult } from "@/lib/grading";
import { useProblemProgress, useProgressStore } from "@/lib/progress";
import { DialectSelector } from "./DialectSelector";
import { GradeBanner } from "./GradeBanner";
import { ResultGrid } from "./ResultGrid";
import { SqlEditor } from "./SqlEditor";
import type { EngineStatus } from "./useEngine";

export interface PredictProblemProps {
  problem: Problem;
  dialect: Dialect;
  onDialectChange: (d: Dialect) => void;
  status: EngineStatus;
  execute: (sql: string) => Promise<QueryResult>;
  mode: "practice" | "mock";
  onGraded?: (passed: boolean) => void;
}

/** "a, b, c" 형식의 줄을 행으로 바꾼다. NULL 또는 빈 값은 null. */
export const parsePredictAnswer = (text: string): Cell[][] =>
  text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) =>
      l.split(/\t|\||,/).map((v) => {
        const s = v.trim().replace(/^["']|["']$/g, "");
        return s === "" || /^null$/i.test(s) ? null : s;
      }),
    );

export function PredictProblem({ problem, dialect, onDialectChange, status, execute, mode, onGraded }: PredictProblemProps) {
  const [, update] = useProblemProgress(problem.id);
  const store = useProgressStore();
  const [text, setText] = useState("");
  // 저장소가 바뀌면(초기 적재 포함) 저장된 입력을 불러온다 (렌더 중 상태 조정 패턴).
  const [syncedStore, setSyncedStore] = useState<typeof store | null>(null);
  if (store !== syncedStore) {
    setSyncedStore(store);
    setText(store[problem.id]?.predictAnswer ?? "");
  }
  const [cmp, setCmp] = useState<CompareResult | null>(null);
  const [actual, setActual] = useState<{ result?: QueryResult; error?: string } | null>(null);
  const [running, setRunning] = useState(false);
  const expected = problem.expected;
  const sql = problem.solutions?.[dialect] ?? "";
  if (!expected || !problem.input) return null;

  const grade = () => {
    const rows = parsePredictAnswer(text);
    const width = rows.length ? Math.max(...rows.map((r) => r.length)) : expected.columns.length;
    const res = compareResult(expected, { columns: new Array<string>(width).fill(""), rows, ms: 0, truncated: false });
    setCmp(res);
    update((p) => ({ attempts: p.attempts + 1, passed: p.passed || res.pass, predictAnswer: text, passedAt: res.pass && !p.passed ? new Date().toISOString() : p.passedAt }));
    onGraded?.(res.pass);
  };

  const runActual = async () => {
    setRunning(true);
    try {
      setActual({ result: await execute(sql) });
    } catch (err) {
      setActual({ error: err instanceof QueryError ? err.message : String(err) });
    } finally {
      setRunning(false);
    }
  };

  const graded = cmp !== null;
  const showAnswer = mode === "practice" && graded;

  return (
    <div className="flex flex-col gap-3">
      <DialectSelector value={dialect} onChange={onDialectChange} status={status} />
      <div className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line ring-inset">
        <p className="border-b border-line px-3.5 py-2.5 text-[12.5px] font-bold text-muted">{problem.input.title}</p>
        <ResultGrid columns={problem.input.columns} rows={problem.input.rows} caption={problem.input.title} />
      </div>
      <div className="min-h-[10rem] overflow-hidden rounded-2xl bg-code-bg ring-1 ring-line ring-inset">
        <SqlEditor value={sql} onChange={() => {}} dialect={dialect} readOnly />
      </div>
      <div className="rounded-2xl bg-surface p-3.5 ring-1 ring-line ring-inset">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="font-mono text-xs text-muted">{expected.columns.join(", ")}</p>
          <p className="text-xs font-medium text-muted">한 줄에 한 행, 값은 쉼표로 구분, 빈 값은 NULL</p>
        </div>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setCmp(null);
          }}
          rows={Math.max(4, expected.rows.length + 1)}
          spellCheck={false}
          aria-label="예상 결과"
          className="w-full rounded-xl bg-code-bg px-3 py-2.5 font-mono text-[12.5px] leading-relaxed text-code-fg ring-1 ring-line-2 outline-none ring-inset focus:ring-2 focus:ring-accent"
        />
        <div className="mt-2 flex items-center gap-2">
          <Button size="sm" onClick={grade} disabled={!text.trim()}>
            채점
          </Button>
          {graded && (
            <Button size="sm" tone="ghost" onClick={runActual} disabled={running || status.state !== "ready"}>
              {running ? "실행 중" : "실행해서 확인"}
            </Button>
          )}
        </div>
      </div>
      {cmp && <GradeBanner cmp={cmp} diagnoses={[]} ms={0} />}
      {actual?.error && (
        <pre className="rounded-2xl bg-fail-soft px-4 py-3 font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap text-fail-ink ring-1 ring-fail/30 ring-inset">{actual.error}</pre>
      )}
      {(actual?.result || showAnswer) && (
        <div className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line ring-inset">
          <UTabs
            label="결과 보기"
            listClassName="px-4"
            items={[
              ...(actual?.result
                ? [{ value: "actual", label: `${DIALECT_LABEL[dialect]} 실행 결과 ${actual.result.rows.length}행`, content: <ResultGrid columns={actual.result.columns} rows={actual.result.rows} caption="실행 결과" /> }]
                : []),
              ...(showAnswer ? [{ value: "expected", label: `정답 결과 ${expected.rows.length}행`, content: <ResultGrid columns={expected.columns} rows={expected.rows} caption="정답 결과" /> }] : []),
            ]}
          />
        </div>
      )}
      {showAnswer && problem.explanation && (
        <Explanation text={problem.explanation}>{problem.dialectNotes?.[dialect] && <p className="text-[12.5px] leading-relaxed font-medium text-muted">{problem.dialectNotes[dialect]}</p>}</Explanation>
      )}
    </div>
  );
}
