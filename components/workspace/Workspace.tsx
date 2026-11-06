"use client";
import { useCallback, useMemo, useState } from "react";
import { CodeBlock, Explanation } from "@/components/practice/Explanation";
import { SolveTopDesktop, SolveTopMobile, type SetNav } from "@/components/practice/SolveHeader";
import { UTabs, type UTabItem } from "@/components/practice/UTabs";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/icons";
import { DIALECT_LABEL, type Dialect, type Problem, type SchemaDef } from "@/lib/content/types";
import { QueryError, type QueryResult } from "@/lib/engine";
import { compareResult, diagnose, type CompareResult, type Diagnosis } from "@/lib/grading";
import { useDialect, useProblemProgress } from "@/lib/progress";
import { DialectSelector, EngineStatusLabel } from "./DialectSelector";
import { GradeBanner } from "./GradeBanner";
import { McqProblem } from "./McqProblem";
import { CODE_BOX, ERROR_BOX, PANE } from "./panes";
import { PredictProblem } from "./PredictProblem";
import { ProblemPanel } from "./ProblemPanel";
import { ResultGrid } from "./ResultGrid";
import { ReviewChecklist, ReviewProblem } from "./ReviewProblem";
import { SchemaPanel } from "./SchemaPanel";
import { SpotProblem } from "./SpotProblem";
import { SqlEditor } from "./SqlEditor";
import { useDesktop } from "./useDesktop";
import { useEngine } from "./useEngine";

export interface WorkspaceProps {
  problem: Problem;
  schema: SchemaDef;
  mode?: "practice" | "mock";
  /** 연습 모드에서 풀이 머리(위치·이전·다음)에 쓰는 세트 정보 */
  nav?: SetNav;
  onGraded?: (passed: boolean) => void;
  footer?: React.ReactNode;
}

interface RunState {
  result?: QueryResult;
  error?: string;
  cmp?: CompareResult;
  diagnoses?: Diagnosis[];
}

type MobileTab = "problem" | "editor" | "result" | "schema";

export function Workspace({ problem, schema, mode = "practice", nav, onGraded, footer }: WorkspaceProps) {
  const [dialect, setDialect] = useDialect();
  const [progress, update] = useProblemProgress(problem.id);
  const [sql, setSql] = useState("");
  const [run, setRun] = useState<RunState>({});
  const [loadedKey, setLoadedKey] = useState("");
  const [running, setRunning] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [resultTab, setResultTab] = useState("result");
  const [tab, setTab] = useState<MobileTab>("problem");
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
      setTab("result");
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
  const isQuery = problem.format === "write" || problem.format === "fix";
  const focusText = `${problem.title} ${problem.prompt} ${problem.tags.join(" ")}`;
  const schemaPanel = <SchemaPanel schema={schema} focusText={focusText} />;

  const problemColumn = (
    <div>
      <ProblemPanel problem={problem} />
      {problem.format === "review" && <ReviewChecklist />}
    </div>
  );

  const special =
    problem.format === "predict" ? (
      <PredictProblem problem={problem} dialect={dialect} onDialectChange={setDialect} status={status} execute={execute} mode={mode} onGraded={onGraded} />
    ) : problem.format === "spot" ? (
      <SpotProblem problem={problem} dialect={dialect} onDialectChange={setDialect} status={status} mode={mode} onGraded={onGraded} />
    ) : problem.format === "review" ? (
      <ReviewProblem problem={problem} schema={schema} dialect={dialect} onDialectChange={setDialect} status={status} execute={execute} mode={mode} onGraded={onGraded} desktop={desktop} schemaPanel={schemaPanel} />
    ) : null;

  const resetButton = problem.starterSql?.[dialect] ? (
    <Button size="sm" tone="ghost" onClick={() => setSql(problem.starterSql?.[dialect] ?? "")}>
      시작 쿼리로 되돌리기
    </Button>
  ) : null;

  const editor = (
    <div className={`${CODE_BOX} ${desktop ? "h-[min(22rem,44vh)] min-h-[13rem] shrink-0" : "h-[min(55dvh,26rem)] min-h-[15rem]"}`}>
      <SqlEditor value={sql} onChange={setSql} dialect={dialect} onRun={onRun} schema={schema} />
    </div>
  );

  const missing =
    run.cmp && !run.cmp.pass && run.cmp.missing.length > 0 ? (
      <div>
        <p className={`pb-1.5 text-[12.5px] font-semibold text-muted ${desktop ? "px-4 pt-3" : "px-1 pt-3.5"}`}>기대 결과에는 있는데 내 결과에 없는 행 {run.cmp.missing.length}개</p>
        <div className={desktop ? "" : "overflow-hidden rounded-[14px] bg-surface ring-1 ring-line ring-inset"}>
          <ResultGrid columns={problem.expected?.columns ?? []} rows={run.cmp.missing} caption="누락 행" highlight={new Map(run.cmp.missing.map((_, i) => [i, "missing"]))} />
        </div>
      </div>
    ) : null;

  const resultItems: UTabItem[] = run.result
    ? [
        {
          value: "result",
          label: `내 결과 ${run.result.rows.length}행`,
          content: (
            <div className={desktop ? "" : "overflow-hidden rounded-[14px] bg-surface ring-1 ring-line ring-inset"}>
              <ResultGrid columns={run.result.columns} rows={run.result.rows} caption="쿼리 결과" highlight={highlight} truncated={run.result.truncated} />
            </div>
          ),
        },
        ...(problem.expected && mode === "practice"
          ? [
              {
                value: "expected",
                label: `기대 결과 ${problem.expected.rows.length}행`,
                content: (
                  <div className={desktop ? "" : "overflow-hidden rounded-[14px] bg-surface ring-1 ring-line ring-inset"}>
                    <ResultGrid columns={problem.expected.columns} rows={problem.expected.rows} caption="기대 결과" />
                  </div>
                ),
              },
            ]
          : []),
      ]
    : [];

  const results = (
    <>
      {run.error && <pre className={ERROR_BOX}>{run.error}</pre>}
      {run.cmp && run.result && <GradeBanner cmp={run.cmp} diagnoses={run.diagnoses ?? []} ms={run.result.ms} />}
      {run.result &&
        (desktop ? (
          <div className="overflow-hidden rounded-[18px] bg-surface pt-1 ring-1 ring-line ring-inset">
            <UTabs label="결과 보기" listClassName="px-4" items={resultItems} value={resultTab} onChange={setResultTab} />
            {missing}
          </div>
        ) : (
          <div>
            <UTabs label="결과 보기" variant="seg" listClassName="mb-2.5" items={resultItems} value={resultTab} onChange={setResultTab} panelClassName="" />
            {missing}
          </div>
        ))}
    </>
  );

  const explanation =
    mode === "practice" ? (
      canSeeExplanation ? (
        <Explanation text={problem.explanation}>
          {solution && <CodeBlock title={`정답 쿼리 · ${DIALECT_LABEL[dialect]}`} code={solution} />}
          {problem.dialectNotes?.[dialect] && <p className="text-[12.5px] leading-relaxed font-medium text-muted">{problem.dialectNotes[dialect]}</p>}
          {problem.wrongPatterns.length > 0 && (
            <div>
              <h3 className="mb-1.5 text-[12.5px] font-bold text-muted">자주 나오는 오답</h3>
              <ul className="space-y-2">
                {problem.wrongPatterns.map((w, i) => (
                  <li key={i} className="text-[13px] leading-[1.6] font-medium text-fg-2">
                    <Chip size="sm" tone="warn" className="mr-1.5">
                      {w.label}
                    </Chip>
                    {w.explanation}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Explanation>
      ) : (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface p-4 ring-1 ring-line ring-inset">
          <p className="text-sm font-medium text-muted">정답을 맞히면 해설과 정답 쿼리가 열립니다.</p>
          <Button size="xs" tone="ghost" onClick={() => setRevealed(true)}>
            해설 먼저 보기
          </Button>
        </div>
      )
    ) : null;

  const toolbar = (
    <div className="flex flex-wrap items-center gap-3">
      <DialectSelector value={dialect} onChange={changeDialect} status={status} />
      <div className="ml-auto flex items-center gap-2">
        {resetButton}
        <Button size="sm" onClick={onRun} disabled={running || status.state !== "ready" || !sql.trim()}>
          <Icon name="play" size={16} filled />
          {running ? "실행 중" : "실행"}
          <span className="rounded-[5px] bg-white/20 px-[5px] py-[3px] font-mono text-[11px] leading-none opacity-80">⌘↩</span>
        </Button>
      </div>
    </div>
  );

  if (desktop) {
    const header = mode === "practice" ? <SolveTopDesktop nav={nav} /> : null;
    const mid =
      problem.format === "mcq" ? (
        <section className="flex min-h-0 min-w-0 flex-col gap-3 overflow-y-auto">
          <McqProblem problem={problem} onGraded={onGraded} />
          {footer}
        </section>
      ) : problem.format === "review" ? null : special ? (
        <section className="flex min-h-0 min-w-0 flex-col gap-3 overflow-y-auto">
          {special}
          {footer}
        </section>
      ) : (
        <section className="flex min-h-0 min-w-0 flex-col gap-3 overflow-y-auto">
          {toolbar}
          {editor}
          {results}
          {explanation}
          {footer}
        </section>
      );
    return (
      <div className={`flex min-h-0 flex-col px-5 ${mode === "practice" ? "h-dvh pt-4" : "flex-1 pt-3"}`}>
        {header}
        <div className="grid min-h-0 flex-1 grid-cols-[clamp(260px,24%,330px)_minmax(0,1fr)_clamp(260px,24%,330px)] gap-4 pb-4">
          <aside className={`${PANE} p-5`}>{problemColumn}</aside>
          {problem.format === "review" ? (
            special
          ) : (
            <>
              {mid}
              <aside className={`${PANE} p-[18px]`}>{schemaPanel}</aside>
            </>
          )}
        </div>
        {problem.format === "review" && footer && <div className="shrink-0 pb-4">{footer}</div>}
      </div>
    );
  }

  const items: UTabItem[] = [
    {
      value: "problem",
      label: "문제",
      content: (
        <div className="space-y-5">
          {problemColumn}
          {problem.format === "mcq" && <McqProblem problem={problem} onGraded={onGraded} />}
        </div>
      ),
    },
    ...(isQuery
      ? [
          {
            value: "editor",
            label: "쿼리",
            content: (
              <div className="space-y-3">
                <EngineStatusLabel status={status} />
                {editor}
                {resetButton && <div className="flex justify-end">{resetButton}</div>}
              </div>
            ),
          },
          {
            value: "result",
            label: "결과",
            pip: run.cmp ? (run.cmp.pass ? ("pass" as const) : ("fail" as const)) : run.error ? ("fail" as const) : null,
            content: (
              <div className="space-y-3">
                {run.result || run.error ? results : <p className="py-8 text-center text-sm font-medium text-muted">아직 실행한 결과가 없습니다.</p>}
                {explanation}
              </div>
            ),
          },
        ]
      : special
        ? [{ value: "editor", label: "풀이", content: special }]
        : []),
    { value: "schema", label: "스키마", hidden: true, content: schemaPanel },
  ];
  const current = items.some((t) => t.value === tab) ? tab : "problem";
  const showTabs = items.filter((t) => !t.hidden).length > 1;
  const top =
    mode === "practice" ? (
      <SolveTopMobile nav={nav} title={problem.title} onSchema={() => setTab(current === "schema" ? "problem" : "schema")} schemaOpen={current === "schema"} />
    ) : null;

  return (
    <div className="flex min-h-dvh flex-col">
      <UTabs
        label="작업 영역"
        items={items}
        value={current}
        onChange={(v) => setTab(v as MobileTab)}
        header={top}
        headerClassName={mode === "practice" ? "sticky top-[env(safe-area-inset-top)] z-20 bg-bg" : ""}
        listClassName={`px-5 !gap-[26px] ${showTabs ? "" : "hidden"}`}
        panelClassName={`px-4 pt-3.5 ${footer ? "pb-4" : "pb-28"}`}
      />
      {footer && <div className="px-4 pb-28">{footer}</div>}
      {isQuery && (
        <div className="fixed inset-x-0 bottom-0 z-30 flex items-start gap-2.5 bg-tab-bg px-4 pt-2.5 pb-[max(env(safe-area-inset-bottom),14px)] shadow-[0_-1px_0_var(--color-line)] backdrop-blur-md">
          <DialectSelector value={dialect} onChange={changeDialect} />
          <Button size="sm" full onClick={onRun} disabled={running || status.state !== "ready" || !sql.trim()} className="min-w-0 flex-1">
            <Icon name="play" size={16} filled />
            {running ? "실행 중" : "실행"}
          </Button>
        </div>
      )}
    </div>
  );
}
