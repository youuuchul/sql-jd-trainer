"use client";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { CodeBlock, Explanation } from "@/components/practice/Explanation";
import { SolveTopDesktop, SolveTopMobile, type SetNav } from "@/components/practice/SolveHeader";
import { UTabs, type UTabItem } from "@/components/practice/UTabs";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/icons";
import { DIALECT_LABEL, type Dialect, type Problem, type SchemaDef } from "@/lib/content/types";
import { QueryError, type QueryResult } from "@/lib/engine";
import { ScriptError, type StatementLog } from "@/lib/engine/script";
import { MAX_ROWS } from "@/lib/engine/types";
import { compareResult, diagnose, type CompareResult, type Diagnosis } from "@/lib/grading";
import { gradeScript } from "@/lib/grading/script";
import { useDialect, useProblemProgress } from "@/lib/progress";
import { recordSkillResult } from "@/lib/skills";
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
  /** 유형에서 들어왔을 때(?skill=) 쓸 풀이 머리. 유형 id → 그 유형의 문제 순서 */
  skillNavs?: Record<string, SetNav>;
  onGraded?: (passed: boolean) => void;
  footer?: React.ReactNode;
}

interface RunState {
  result?: QueryResult;
  error?: string;
  cmp?: CompareResult;
  diagnoses?: Diagnosis[];
  /** 파이프라인 문제: 문장별 실행 기록과 추가 결과 */
  script?: {
    log: StatementLog[];
    /** 두 번째부터의 확인 조회 결과 */
    probes: QueryResult[];
    /** 확인 조회가 있을 때 스크립트 마지막 조회 결과 */
    last: QueryResult | null;
    /** 기본 검사가 아닌 곳(변형·두 번 실행)에서 틀렸으면 그 이름 */
    failedAt: string | null;
    headSwapped: boolean;
  };
}

const KIND_LABEL: Record<StatementLog["kind"], string> = {
  SELECT: "SELECT",
  "CREATE TABLE": "CREATE TABLE",
  INSERT: "INSERT",
  DELETE: "DELETE",
  UPDATE: "UPDATE",
  "DROP TABLE": "DROP TABLE",
  TRUNCATE: "TRUNCATE",
  DECLARE: "DECLARE",
  SET: "SET",
};

/** 표시용으로 행 수를 자른다(채점은 전체 행으로 이미 끝났다) */
const forDisplay = (r: QueryResult): QueryResult => (r.rows.length > MAX_ROWS ? { ...r, rows: r.rows.slice(0, MAX_ROWS), truncated: true } : r);

function StatementLogGrid({ log }: { log: StatementLog[] }) {
  return (
    <ResultGrid
      columns={["줄", "문장", "대상", "행 수"]}
      rows={log.map((l) => [l.line, KIND_LABEL[l.kind], l.table ?? "", l.rows ?? ""])}
      caption="문장별 실행 기록"
      emptyMessage="실행한 문장이 없습니다."
    />
  );
}

const subscribeNever = () => () => {};

type MobileTab = "problem" | "editor" | "result" | "schema";

const readSkillParam = () => new URLSearchParams(window.location.search).get("skill");

export function Workspace({ problem, schema, mode = "practice", nav: setNav, skillNavs, onGraded: onGradedProp, footer }: WorkspaceProps) {
  const skillParam = useSyncExternalStore(subscribeNever, readSkillParam, () => null);
  const nav = (skillParam ? skillNavs?.[skillParam] : undefined) ?? setNav;
  const primarySkill = problem.skills[0];
  const onGraded = useCallback(
    (passed: boolean) => {
      recordSkillResult(primarySkill, passed);
      onGradedProp?.(passed);
    },
    [primarySkill, onGradedProp],
  );
  const [dialect, setDialect] = useDialect();
  const [progress, update] = useProblemProgress(problem.id);
  const [sql, setSql] = useState("");
  const [run, setRun] = useState<RunState>({});
  const [loadedKey, setLoadedKey] = useState("");
  const [running, setRunning] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [resultTab, setResultTab] = useState("result");
  const [tab, setTab] = useState<MobileTab>("problem");
  const { status, run: execute, runScript } = useEngine(dialect, schema);
  const desktop = useDesktop();

  // 하이드레이션 중에는 저장소(localStorage)·방언이 서버 값이라, 끝난 뒤에 저장된 쿼리를 불러온다.
  const hydrated = useSyncExternalStore(subscribeNever, () => true, () => false);
  // 방언이나 문제가 바뀌면 저장된 쿼리 또는 시작 쿼리를 불러온다 (렌더 중 상태 조정 패턴).
  const editorKey = hydrated ? `${problem.id}:${dialect}` : "";
  if (hydrated && loadedKey !== editorKey) {
    setLoadedKey(editorKey);
    setSql(progress.sql[dialect] ?? problem.starterSql?.[dialect] ?? "");
    setRun({});
  }

  // 작성 중인 쿼리를 방언별로 저장한다(새로고침 후 복원). 모의 시험은 실행·방언 전환 때만 저장한다.
  const savedSql = progress.sql[dialect];
  const baseline = savedSql ?? problem.starterSql?.[dialect] ?? "";
  const dirty = mode === "practice" && hydrated && loadedKey === editorKey && sql !== baseline;
  const pending = useRef({ sql, dialect, dirty });
  useEffect(() => {
    pending.current = { sql, dialect, dirty };
  });
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => update((p) => ({ sql: { ...p.sql, [dialect]: sql } })), 500);
    return () => clearTimeout(t);
  }, [dirty, sql, dialect, update]);
  // 디바운스 대기 중에 화면을 떠나거나 새로고침해도 마지막 입력을 남긴다
  useEffect(() => {
    const flush = () => {
      const { sql: s, dialect: d, dirty: d2 } = pending.current;
      if (d2) update((p) => ({ sql: { ...p.sql, [d]: s } }));
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [update]);

  const changeDialect = (d: Dialect) => {
    update((p) => ({ sql: { ...p.sql, [dialect]: sql } }));
    setDialect(d);
  };

  const onRun = useCallback(async () => {
    if (!sql.trim() || running) return;
    setRunning(true);
    update((p) => ({ sql: { ...p.sql, [dialect]: sql } }));
    if (problem.script) {
      try {
        const g = await gradeScript(runScript, problem, dialect, schema, sql);
        const probes = g.view.probes.map((o) => (o.result ? forDisplay(o.result) : null));
        const shown = problem.script.probes.length ? probes[0] : g.view.last;
        const script = {
          log: g.view.log,
          probes: probes.slice(1).filter((r): r is QueryResult => r !== null),
          last: problem.script.probes.length ? g.view.last : null,
          failedAt: g.failedAt,
          headSwapped: g.headSwapped,
        };
        setRun({ result: shown ? { ...shown, ms: g.view.ms } : { columns: [], rows: [], ms: g.view.ms, truncated: false }, cmp: g.cmp, diagnoses: g.diagnoses, script });
        setResultTab("result");
        update((p) => ({ attempts: p.attempts + 1, passed: p.passed || g.pass, passedAt: g.pass && !p.passed ? new Date().toISOString() : p.passedAt }));
        onGraded(g.pass);
      } catch (err) {
        setRun({
          error: err instanceof Error ? err.message : String(err),
          ...(err instanceof ScriptError && err.log.length ? { script: { log: err.log, probes: [], last: null, failedAt: null, headSwapped: false } } : {}),
        });
      } finally {
        setRunning(false);
        setTab("result");
      }
      return;
    }
    try {
      const result = await execute(sql);
      const expected = problem.expected;
      if (expected && expected.rows.length) {
        const cmp = compareResult(expected, result);
        const diagnoses = cmp.pass ? [] : diagnose(problem, result, cmp);
        setRun({ result, cmp, diagnoses });
        setResultTab("result");
        update((p) => ({ attempts: p.attempts + 1, passed: p.passed || cmp.pass, passedAt: cmp.pass && !p.passed ? new Date().toISOString() : p.passedAt }));
        onGraded(cmp.pass);
      } else setRun({ result });
    } catch (err) {
      setRun({ error: err instanceof QueryError ? err.message : String(err) });
    } finally {
      setRunning(false);
      setTab("result");
    }
  }, [sql, running, execute, runScript, problem, schema, dialect, update, onGraded]);

  const highlight = useMemo(() => {
    const map = new Map<number, "extra" | "missing">();
    // 변형·두 번 실행에서 틀렸거나 머리를 바꿔 실험한 결과는 기본 기대 결과와 행 단위로 맞대지 않는다
    if (!run.cmp || !run.result || run.script?.failedAt || run.script?.headSwapped) return map;
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
      <SqlEditor value={sql} onChange={setSql} dialect={dialect} onRun={onRun} schema={schema} prewritten={problem.script ? problem.starterSql?.[dialect] : undefined} />
    </div>
  );

  const missing =
    run.cmp && !run.cmp.pass && run.cmp.missing.length > 0 && !run.script?.failedAt && !run.script?.headSwapped ? (
      <div>
        <p className={`pb-1.5 text-[12.5px] font-semibold text-muted ${desktop ? "px-4 pt-3" : "px-1 pt-3.5"}`}>기대 결과에는 있는데 내 결과에 없는 행 {run.cmp.missing.length}개</p>
        <div className={desktop ? "" : "overflow-hidden rounded-[14px] bg-surface ring-1 ring-line ring-inset"}>
          <ResultGrid columns={problem.expected?.columns ?? []} rows={run.cmp.missing} caption="누락 행" highlight={new Map(run.cmp.missing.map((_, i) => [i, "missing"]))} />
        </div>
      </div>
    ) : null;

  const box = (node: React.ReactNode) => <div className={desktop ? "" : "overflow-hidden rounded-[14px] bg-surface ring-1 ring-line ring-inset"}>{node}</div>;
  const scriptItems: UTabItem[] = run.script
    ? [
        ...run.script.probes.map((r, i) => ({ value: `probe-${i + 2}`, label: `확인 조회 ${i + 2} ${r.rows.length}행`, content: box(<ResultGrid columns={r.columns} rows={r.rows} caption={`확인 조회 ${i + 2}`} truncated={r.truncated} />) })),
        ...(run.script.last ? [{ value: "last", label: `마지막 조회 ${run.script.last.rows.length}행`, content: box(<ResultGrid columns={run.script.last.columns} rows={run.script.last.rows} caption="마지막 조회 결과" truncated={run.script.last.truncated} />) }] : []),
      ]
    : [];
  const logItem: UTabItem[] = run.script ? [{ value: "log", label: `실행 기록 ${run.script.log.length}문장`, content: box(<StatementLogGrid log={run.script.log} />) }] : [];

  const resultItems: UTabItem[] = run.result
    ? [
        {
          value: "result",
          label: `내 결과 ${run.result.rows.length}행`,
          content: box(<ResultGrid columns={run.result.columns} rows={run.result.rows} caption="쿼리 결과" highlight={highlight} truncated={run.result.truncated} />),
        },
        ...scriptItems,
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
        ...logItem,
      ]
    : [];

  const results = (
    <>
      {run.error && <pre className={ERROR_BOX}>{run.error}</pre>}
      {run.error && run.script && <div className="overflow-hidden rounded-[14px] bg-surface ring-1 ring-line ring-inset"><StatementLogGrid log={run.script.log} /></div>}
      {run.cmp && run.result && <GradeBanner cmp={run.cmp} diagnoses={run.diagnoses ?? []} ms={run.result.ms} scope={run.script?.failedAt ?? undefined} />}
      {run.script?.headSwapped && <p className="px-1 text-[12.5px] font-medium text-muted">채점은 문제의 변수 설정으로 다시 실행한 결과입니다.</p>}
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
        <section className="flex min-h-0 min-w-0 flex-col gap-3 overflow-y-auto [&>*]:shrink-0">
          <McqProblem problem={problem} onGraded={onGraded} />
          {footer}
        </section>
      ) : problem.format === "review" ? null : special ? (
        <section className="flex min-h-0 min-w-0 flex-col gap-3 overflow-y-auto [&>*]:shrink-0">
          {special}
          {footer}
        </section>
      ) : (
        <section className="flex min-h-0 min-w-0 flex-col gap-3 overflow-y-auto [&>*]:shrink-0">
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
