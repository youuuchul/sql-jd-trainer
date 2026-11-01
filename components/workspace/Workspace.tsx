"use client";
import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui-lab/components/button/Button";
import { Tabs } from "@/components/ui-lab/components/tabs/Tabs";
import { DIALECT_LABEL, type Dialect, type Problem, type SchemaDef } from "@/lib/content/types";
import { QueryError, type QueryResult } from "@/lib/engine";
import { compareResult, diagnose, type CompareResult, type Diagnosis } from "@/lib/grading";
import { useDialect, useProblemProgress } from "@/lib/progress";
import { renderText } from "@/lib/text";
import { DialectSelector } from "./DialectSelector";
import { GradeBanner } from "./GradeBanner";
import { McqProblem } from "./McqProblem";
import { ProblemPanel } from "./ProblemPanel";
import { ResultGrid } from "./ResultGrid";
import { SchemaPanel } from "./SchemaPanel";
import { SqlEditor } from "./SqlEditor";
import { useDesktop } from "./useDesktop";
import { useEngine } from "./useEngine";

export interface WorkspaceProps {
  problem: Problem;
  schema: SchemaDef;
  mode?: "practice" | "mock";
  index?: number;
  total?: number;
  onGraded?: (passed: boolean) => void;
  footer?: React.ReactNode;
}

interface RunState {
  result?: QueryResult;
  error?: string;
  cmp?: CompareResult;
  diagnoses?: Diagnosis[];
}

export function Workspace({ problem, schema, mode = "practice", index, total, onGraded, footer }: WorkspaceProps) {
  const [dialect, setDialect] = useDialect();
  const [progress, update] = useProblemProgress(problem.id);
  const [sql, setSql] = useState("");
  const [run, setRun] = useState<RunState>({});
  const [loadedKey, setLoadedKey] = useState("");
  const [running, setRunning] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [resultTab, setResultTab] = useState("result");
  const { status, run: execute } = useEngine(dialect, schema);
  const desktop = useDesktop();

  // 방언이나 문제가 바뀌면 저장된 쿼리 또는 시작 쿼리를 불러온다 (렌더 중 상태 조정 패턴).
  const editorKey = `${problem.id}:${dialect}`;
  if (loadedKey !== editorKey) {
    setLoadedKey(editorKey);
    setSql(progress.sql[dialect] ?? problem.starterSql?.[dialect] ?? "");
    setRun({});
  }

  const changeDialect = (d: Dialect) => {
    update((p) => ({ sql: { ...p.sql, [dialect]: sql } }));
    setDialect(d);
  };

  const onRun = useCallback(async () => {
    if (!sql.trim() || running) return;
    setRunning(true);
    update((p) => ({ sql: { ...p.sql, [dialect]: sql } }));
    try {
      const result = await execute(sql);
      const expected = problem.expected;
      if (expected && expected.rows.length) {
        const cmp = compareResult(expected, result);
        const diagnoses = cmp.pass ? [] : diagnose(problem, result, cmp);
        setRun({ result, cmp, diagnoses });
        setResultTab("result");
        update((p) => ({ attempts: p.attempts + 1, passed: p.passed || cmp.pass, passedAt: cmp.pass && !p.passed ? new Date().toISOString() : p.passedAt }));
        onGraded?.(cmp.pass);
      } else setRun({ result });
    } catch (err) {
      setRun({ error: err instanceof QueryError ? err.message : String(err) });
    } finally {
      setRunning(false);
    }
  }, [sql, running, execute, problem, dialect, update, onGraded]);

  const highlight = useMemo(() => {
    const map = new Map<number, "extra" | "missing">();
    if (!run.cmp || !run.result) return map;
    const extraKeys = new Set(run.cmp.extra.map((r) => JSON.stringify(r)));
    run.result.rows.forEach((r, i) => {
      if (extraKeys.has(JSON.stringify(r))) map.set(i, "extra");
    });
    return map;
  }, [run]);

  const canSeeExplanation = mode === "practice" && (progress.passed || revealed);
  const solution = problem.solutions?.[dialect];

  const problemColumn = (
    <div className="space-y-6">
      <ProblemPanel problem={problem} index={index} total={total} />
      {problem.format === "mcq" && <McqProblem problem={problem} onGraded={onGraded} />}
    </div>
  );

  const editorColumn =
    problem.format === "mcq" ? null : (
      <div className="flex h-full min-h-[32rem] flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <DialectSelector value={dialect} onChange={changeDialect} status={status} />
          <div className="flex items-center gap-2">
            {problem.starterSql?.[dialect] && (
              <Button size="sm" variant="ghost" onClick={() => setSql(problem.starterSql?.[dialect] ?? "")}>
                시작 쿼리로 되돌리기
              </Button>
            )}
            <Button size="sm" onClick={onRun} loading={running} disabled={status.state !== "ready" || !sql.trim()}>
              실행 <span className="ml-1 font-mono text-[11px] opacity-70">⌘↩</span>
            </Button>
          </div>
        </div>
        <div className="min-h-[14rem] flex-1 overflow-hidden rounded-xl border border-line bg-bg">
          <SqlEditor value={sql} onChange={setSql} dialect={dialect} onRun={onRun} />
        </div>
        {run.error && (
          <pre className="rounded-xl border border-fail/40 bg-fail/10 px-4 py-3 font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap text-fail">
            {run.error}
          </pre>
        )}
        {run.cmp && run.result && <GradeBanner cmp={run.cmp} diagnoses={run.diagnoses ?? []} ms={run.result.ms} />}
        {run.result && (
          <div className="rounded-xl border border-line bg-surface">
            <Tabs
              label="결과 보기"
              value={resultTab}
              onChange={setResultTab}
              items={[
                {
                  value: "result",
                  label: `내 결과 ${run.result.rows.length}행`,
                  content: <ResultGrid columns={run.result.columns} rows={run.result.rows} caption="쿼리 결과" highlight={highlight} truncated={run.result.truncated} />,
                },
                ...(problem.expected && mode === "practice"
                  ? [
                      {
                        value: "expected",
                        label: `기대 결과 ${problem.expected.rows.length}행`,
                        content: <ResultGrid columns={problem.expected.columns} rows={problem.expected.rows} caption="기대 결과" />,
                      },
                    ]
                  : []),
              ]}
            />
            {run.cmp && !run.cmp.pass && run.cmp.missing.length > 0 && (
              <div className="border-t border-line px-3 py-2">
                <p className="mb-1 text-xs text-muted">기대 결과에는 있는데 내 결과에 없는 행 (최대 5개)</p>
                <ResultGrid columns={problem.expected?.columns ?? []} rows={run.cmp.missing} caption="누락 행" highlight={new Map(run.cmp.missing.map((_, i) => [i, "missing"]))} />
              </div>
            )}
          </div>
        )}
        {mode === "practice" && (
          <section className="rounded-xl border border-line bg-surface p-4">
            {canSeeExplanation ? (
              <div className="space-y-3">
                <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">해설</h2>
                {renderText(problem.explanation)}
                {solution && (
                  <div>
                    <h3 className="mb-1 text-xs font-semibold text-muted">정답 쿼리 · {DIALECT_LABEL[dialect]}</h3>
                    <pre className="overflow-x-auto rounded-xl border border-line bg-bg p-3 font-mono text-[12.5px] leading-relaxed">{solution}</pre>
                  </div>
                )}
                {problem.dialectNotes?.[dialect] && <p className="text-[12.5px] leading-relaxed text-muted">{problem.dialectNotes[dialect]}</p>}
                {problem.wrongPatterns.length > 0 && (
                  <div>
                    <h3 className="mb-1 text-xs font-semibold text-muted">자주 나오는 오답</h3>
                    <ul className="space-y-1">
                      {problem.wrongPatterns.map((w, i) => (
                        <li key={i} className="text-[12.5px] leading-relaxed text-fg/80">
                          <span className="mr-1.5 rounded-md bg-warn/20 px-1.5 py-0.5 text-[11px] font-medium text-warn">{w.label}</span>
                          {w.explanation}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted">정답을 맞히면 해설과 정답 쿼리가 열립니다.</p>
                <Button size="sm" variant="secondary" onClick={() => setRevealed(true)}>
                  해설 먼저 보기
                </Button>
              </div>
            )}
          </section>
        )}
        {footer}
      </div>
    );

  const schemaColumn = <SchemaPanel schema={schema} />;

  if (!desktop) {
    return (
      <div className="mx-auto w-full px-4 py-4">
        <Tabs
          label="작업 영역"
          items={[
            { value: "problem", label: "문제", content: <div className="py-3">{problemColumn}</div> },
            ...(editorColumn ? [{ value: "editor", label: "쿼리", content: <div className="py-3">{editorColumn}</div> }] : []),
            { value: "schema", label: "스키마", content: <div className="py-3">{schemaColumn}</div> },
          ]}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-[1600px] grid-cols-[21rem_minmax(0,1fr)_21rem] gap-5 px-5 py-4">
      <aside className="max-h-[calc(100vh-6rem)] overflow-y-auto rounded-card border border-line bg-surface p-5">{problemColumn}</aside>
      <section className="min-w-0">{editorColumn ?? <div className="rounded-card border border-line bg-surface p-5">{footer}</div>}</section>
      <aside className="max-h-[calc(100vh-6rem)] overflow-y-auto rounded-card border border-line bg-surface p-5">{schemaColumn}</aside>
    </div>
  );
}
