"use client";
import { useCallback, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/icons";
import { CodeBlock, Explanation } from "@/components/practice/Explanation";
import { UTabs } from "@/components/practice/UTabs";
import { DIALECT_LABEL, REVIEW_CATEGORIES, REVIEW_CATEGORY, type Dialect, type Problem, type ReviewCategory, type ReviewDecoy, type ReviewDefect, type SchemaDef } from "@/lib/content/types";
import { QueryError, type QueryResult } from "@/lib/engine";
import { gradeReview, reviewDecoys, reviewDefects, type DefectStatus, type MarkVerdict } from "@/lib/grading";
import { useProblemProgress, type ReviewMark } from "@/lib/progress";
import { DialectSelector, EngineStatusLabel } from "./DialectSelector";
import { Verdict } from "./GradeBanner";
import { CODE_BOX, ERROR_BOX, PANE } from "./panes";
import { ResultGrid } from "./ResultGrid";
import { SqlEditor } from "./SqlEditor";
import type { EngineStatus } from "./useEngine";

export interface ReviewProblemProps {
  problem: Problem;
  schema: SchemaDef;
  dialect: Dialect;
  onDialectChange: (d: Dialect) => void;
  status: EngineStatus;
  execute: (sql: string) => Promise<QueryResult>;
  mode: "practice" | "mock";
  onGraded?: (passed: boolean) => void;
  /** 데스크톱이면 가운데 칸과 오른쪽 칸을 형제 요소로 돌려준다(부모 격자의 두 칸을 차지) */
  desktop: boolean;
  /** 오른쪽 칸의 스키마 탭 내용 */
  schemaPanel: ReactNode;
}

const VERDICT_LABEL: Record<MarkVerdict, string> = { hit: "맞음", "wrong-type": "유형 다름", false: "결함 아님" };
const STATUS_LABEL: Record<DefectStatus, string> = { found: "찾음", "wrong-type": "유형 다름", missed: "놓침" };
const STATUS_TONE: Record<DefectStatus, "pass" | "warn" | "fail"> = { found: "pass", "wrong-type": "warn", missed: "fail" };

const TOKEN = /'(?:[^']|'')*'|\b\d+(?:\.\d+)?\b|\b[A-Z][A-Z0-9_]*\b/g;

/** 양식 통일로 키워드·함수가 대문자라 대문자 단어와 리터럴만 칠한다 */
const highlightLine = (text: string): ReactNode[] => {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    const tok = m[0];
    if (m.index > last) out.push(text.slice(last, m.index));
    const cls = tok.startsWith("'")
      ? "text-syntax-string"
      : /^\d/.test(tok)
        ? "text-syntax-number"
        : /^\s*\(/.test(text.slice(m.index + tok.length))
          ? "text-syntax-function"
          : "font-medium text-syntax-keyword";
    out.push(
      <span key={m.index} className={cls}>
        {tok}
      </span>,
    );
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
};

const byLine = <T extends { lines: Partial<Record<Dialect, number[]>> }>(refs: T[], dialect: Dialect) => {
  const map = new Map<number, T>();
  for (const r of refs) for (const l of r.lines[dialect] ?? []) map.set(l, r);
  return map;
};

export function ReviewChecklist() {
  return (
    <section className="mt-[18px]">
      <h2 className="text-[12.5px] font-bold tracking-[0.01em] text-muted">리뷰 체크리스트</h2>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-[7px] text-[13px] leading-[1.5]">
        {REVIEW_CATEGORIES.map((c) => (
          <div key={c} className="contents">
            <dt className="font-bold whitespace-nowrap">{REVIEW_CATEGORY[c].label}</dt>
            <dd className="font-medium text-muted">{REVIEW_CATEGORY[c].cue}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function ReviewProblem({ problem, schema, dialect, onDialectChange, status, execute, mode, onGraded, desktop, schemaPanel }: ReviewProblemProps) {
  const [progress, update] = useProblemProgress(problem.id);
  const [active, setActive] = useState<number | null>(null);
  const [gradedKey, setGradedKey] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [checkSql, setCheckSql] = useState("");
  const [check, setCheck] = useState<{ dialect: Dialect; result?: QueryResult; error?: string } | null>(null);
  const [running, setRunning] = useState(false);
  const [asideTab, setAsideTab] = useState<{ value: string; answered: boolean } | null>(null);

  const runCheck = useCallback(async () => {
    if (!checkSql.trim() || running) return;
    setRunning(true);
    try {
      setCheck({ dialect, result: await execute(checkSql) });
    } catch (err) {
      setCheck({ dialect, error: err instanceof QueryError ? err.message : String(err) });
    } finally {
      setRunning(false);
    }
  }, [checkSql, running, execute, dialect]);

  const review = problem.review;
  const expected = problem.expected;
  if (!review || !expected) return null;

  const sql = review.sql[dialect] ?? review.sql.postgres ?? "";
  const lines = sql.split("\n");
  const result = review.results[dialect];
  const solution = problem.solutions?.[dialect];
  const marks = progress.reviewMarks?.[dialect] ?? [];
  const marksKey = `${dialect}:${JSON.stringify(marks)}`;
  const grade = gradedKey === marksKey ? gradeReview(review, dialect, marks) : null;
  const showAnswer = mode === "practice" && (revealed || progress.passed);
  const verdicts = mode === "practice" ? grade?.verdicts : undefined;
  const defectAt = byLine<ReviewDefect>(reviewDefects(review, dialect), dialect);
  const decoyAt = byLine<ReviewDecoy>(reviewDecoys(review, dialect), dialect);

  const saveMarks = (next: ReviewMark[]) => update((p) => ({ reviewMarks: { ...p.reviewMarks, [dialect]: next.sort((a, b) => a.line - b.line) } }));
  const setMark = (line: number, category: ReviewCategory) => {
    saveMarks([...marks.filter((m) => m.line !== line), { line, category }]);
    setActive(null);
  };
  const clearMark = (line: number) => {
    saveMarks(marks.filter((m) => m.line !== line));
    setActive(null);
  };
  const resetMarks = () => {
    saveMarks([]);
    setGradedKey(null);
    setActive(null);
  };

  const submit = () => {
    const g = gradeReview(review, dialect, marks);
    setGradedKey(marksKey);
    setActive(null);
    update((p) => ({ attempts: p.attempts + 1, passed: p.passed || g.pass, passedAt: g.pass && !p.passed ? new Date().toISOString() : p.passedAt }));
    onGraded?.(g.pass);
  };

  const answer = showAnswer ? gradeReview(review, dialect, marks) : null;
  const decoyList = answer ? reviewDecoys(review, dialect) : [];

  const asideItems = [
    ...(answer
      ? [
          {
            value: "defects",
            label: `결함 ${answer.total}`,
            content: (
              <ul>
                {answer.defects.map(({ defect, status: st }) => (
                  <li key={defect.title} className="border-b border-line py-3.5 first:pt-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Chip size="sm" tone="fail">
                        {REVIEW_CATEGORY[defect.category].label}
                      </Chip>
                      <span className="font-mono text-xs text-muted">줄 {(defect.lines[dialect] ?? []).join(", ")}</span>
                      <Chip size="sm" tone={STATUS_TONE[st]}>
                        {STATUS_LABEL[st]}
                      </Chip>
                    </div>
                    <h3 className="mt-2 text-[14.5px] leading-[1.4] font-extrabold tracking-[-0.02em]">{defect.title}</h3>
                    <p className="mt-1 text-[13px] leading-[1.6] text-fg-2">{defect.explanation}</p>
                  </li>
                ))}
              </ul>
            ),
          },
          ...(decoyList.length
            ? [
                {
                  value: "decoys",
                  label: `맞는 줄 ${decoyList.length}`,
                  content: (
                    <ul>
                      {decoyList.map((d) => (
                        <li key={d.explanation} className="border-b border-line py-3.5 first:pt-1">
                          <span className="font-mono text-xs text-muted">줄 {(d.lines[dialect] ?? []).join(", ")}</span>
                          <p className="mt-1 text-[13px] leading-[1.6] text-fg-2">{d.explanation}</p>
                        </li>
                      ))}
                    </ul>
                  ),
                },
              ]
            : []),
        ]
      : []),
    { value: "schema", label: "스키마", content: schemaPanel },
  ];
  const tab = asideTab && asideTab.answered === Boolean(answer) ? asideTab.value : answer ? "defects" : "schema";
  const aside = (
    <div className="min-w-0">
      <UTabs label="리뷰 결과" size="sm" items={asideItems} value={tab} onChange={(value) => setAsideTab({ value, answered: Boolean(answer) })} panelClassName="pt-3" />
      {answer && problem.explanation && (
        <div className="mt-4">
          <Explanation text={problem.explanation}>{problem.dialectNotes?.[dialect] && <p className="text-[12.5px] leading-relaxed font-medium text-muted">{problem.dialectNotes[dialect]}</p>}</Explanation>
        </div>
      )}
    </div>
  );

  const mid = (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <DialectSelector value={dialect} onChange={onDialectChange} />
        {grade ? (
          <span className="flex items-center gap-1.5 text-[13px] font-semibold text-muted">
            <span className={`inline-block h-[7px] w-[7px] rounded-full ${grade.pass ? "bg-pass" : "bg-fail"}`} aria-hidden="true" />
            채점 완료
          </span>
        ) : (
          <EngineStatusLabel status={status} />
        )}
        <span className="ml-auto flex items-center gap-2">
          {grade && (
            <Button size="sm" tone="ghost" onClick={resetMarks}>
              표시 다시 하기
            </Button>
          )}
          <Button size="sm" onClick={submit} disabled={marks.length === 0}>
            채점
          </Button>
        </span>
      </div>
      <div className="overflow-hidden rounded-2xl bg-code-bg py-2 text-code-fg ring-1 ring-line ring-inset">
        <div className="mb-1.5 flex items-center justify-between border-b border-line px-4 pt-1 pb-2.5 text-[12.5px] font-semibold text-muted">
          <span>검토할 쿼리</span>
          <span>표시 {marks.length}줄</span>
        </div>
        <ol className="font-mono text-[13.5px] leading-[30px]">
          {lines.map((text, i) => {
            const n = i + 1;
            const mark = marks.find((m) => m.line === n);
            const verdict = mark ? verdicts?.[n] : undefined;
            const defect = showAnswer ? defectAt.get(n) : undefined;
            const decoy = showAnswer ? decoyAt.get(n) : undefined;
            const missed = Boolean(defect && !mark);
            const note = mark || missed || decoy;
            return (
              <li key={n}>
                <button
                  type="button"
                  onClick={() => setActive((a) => (a === n ? null : n))}
                  aria-pressed={Boolean(mark)}
                  aria-expanded={active === n}
                  aria-label={`${n}번째 줄`}
                  className={`block w-full text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent ${missed ? "bg-fail-soft shadow-[inset_3px_0_0_var(--color-fail)]" : mark ? "bg-accent-soft shadow-[inset_3px_0_0_var(--color-accent)]" : "hover:bg-surface-2/60"}`}
                >
                  <span className="grid grid-cols-[46px_1fr] pr-3.5">
                    <span className={`pr-4 text-right text-[12.5px] select-none ${missed ? "font-bold text-fail-ink" : mark ? "font-bold text-accent-ink" : "text-faint"}`}>{n}</span>
                    <span className="min-w-0 overflow-x-auto whitespace-pre [scrollbar-width:none]">{highlightLine(text)}</span>
                  </span>
                  {note && (
                    <span className="flex flex-wrap items-center gap-1.5 pb-1.5 pl-[62px] font-sans leading-normal">
                      {mark && (
                        <>
                          <Chip size="sm" tone={verdict ? "neutral" : "accent"} className={verdict && verdict !== "hit" ? "line-through decoration-[1.5px] opacity-75" : ""}>
                            {REVIEW_CATEGORY[mark.category].label}
                          </Chip>
                          {verdict && (
                            <>
                              <span aria-hidden="true" className="text-xs text-faint">
                                →
                              </span>
                              <Chip size="sm" tone={verdict === "hit" ? "pass" : verdict === "wrong-type" ? "warn" : "neutral"}>
                                {verdict === "hit" && <Icon name="check" size={13} strokeWidth={2.6} />}
                                {VERDICT_LABEL[verdict]}
                                {verdict === "wrong-type" && defect && defect.category !== mark.category && ` · ${REVIEW_CATEGORY[defect.category].label}`}
                              </Chip>
                            </>
                          )}
                        </>
                      )}
                      {missed && defect && (
                        <Chip size="sm" tone="fail">
                          놓침 · {REVIEW_CATEGORY[defect.category].label}
                        </Chip>
                      )}
                      {!mark && decoy && <Chip size="sm">맞는 줄</Chip>}
                    </span>
                  )}
                </button>
                {active === n && (
                  <div role="radiogroup" aria-label={`${n}번째 줄 결함 유형`} className="flex flex-wrap items-center gap-1.5 bg-surface-2 py-2.5 pr-3.5 pl-[62px] font-sans leading-normal">
                    {REVIEW_CATEGORIES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        role="radio"
                        aria-checked={mark?.category === c}
                        onClick={() => setMark(n, c)}
                        className={`h-8 rounded-[10px] px-3 text-[12.5px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-accent ${mark?.category === c ? "bg-accent text-on-accent" : "bg-surface text-fg-2 ring-1 ring-line-2 ring-inset hover:bg-surface-3"}`}
                      >
                        {REVIEW_CATEGORY[c].label}
                      </button>
                    ))}
                    {mark && (
                      <button type="button" onClick={() => clearMark(n)} className="ml-1 h-8 px-1.5 text-[12.5px] font-semibold text-muted hover:text-fg">
                        표시 지우기
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </div>
      {grade && (
        <Verdict
          pass={grade.pass}
          action={
            mode === "practice" && !showAnswer ? (
              <Button size="xs" tone="ghost" onClick={() => setRevealed(true)}>
                정답 보기
              </Button>
            ) : undefined
          }
        >
          <span>
            결함 {grade.total}개 중 {grade.found}개 찾음{grade.wrongType > 0 && ` · 유형 다름 ${grade.wrongType}줄`}
            {grade.falseMarks > 0 && ` · 결함 아님 ${grade.falseMarks}줄`}
          </span>
        </Verdict>
      )}
      <div className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line ring-inset">
        <UTabs
          label="결과 보기"
          listClassName="px-4"
          items={[
            ...(result
              ? [
                  {
                    value: "review",
                    label: `검토 쿼리 결과 ${result.rows.length}행`,
                    content: <ResultGrid columns={result.columns} rows={result.rows} caption="검토 쿼리 결과" highlight={showAnswer ? new Map(result.anomalyRows.map((r) => [r, "extra" as const])) : undefined} />,
                  },
                ]
              : []),
            {
              value: "check",
              label: "검증 쿼리",
              content: (
                <div className="space-y-2.5 p-3.5">
                  <div className={`h-36 ${CODE_BOX}`}>
                    <SqlEditor value={checkSql} onChange={setCheckSql} dialect={dialect} onRun={runCheck} schema={schema} />
                  </div>
                  <div className="flex justify-end">
                    <Button size="sm" onClick={runCheck} disabled={running || status.state !== "ready" || !checkSql.trim()}>
                      <Icon name="play" size={16} filled />
                      {running ? "실행 중" : "실행"} <span className="font-mono text-[11px] opacity-70">⌘↩</span>
                    </Button>
                  </div>
                  {check?.dialect === dialect && check.error && <pre className={ERROR_BOX}>{check.error}</pre>}
                  {check?.dialect === dialect && check.result && (
                    <div className="overflow-hidden rounded-xl ring-1 ring-line ring-inset">
                      <ResultGrid columns={check.result.columns} rows={check.result.rows} caption="검증 쿼리 결과" truncated={check.result.truncated} />
                    </div>
                  )}
                </div>
              ),
            },
            ...(showAnswer
              ? [
                  { value: "expected", label: `올바른 결과 ${expected.rows.length}행`, content: <ResultGrid columns={expected.columns} rows={expected.rows} caption="올바른 결과" /> },
                  ...(solution
                    ? [
                        {
                          value: "solution",
                          label: `올바른 쿼리 · ${DIALECT_LABEL[dialect]}`,
                          content: (
                            <div className="p-3.5">
                              <CodeBlock code={solution} />
                            </div>
                          ),
                        },
                      ]
                    : []),
                ]
              : []),
          ]}
        />
      </div>
    </div>
  );

  if (desktop)
    return (
      <>
        <section className="flex min-h-0 min-w-0 flex-col overflow-y-auto">{mid}</section>
        <aside className={`${PANE} p-[18px]`}>{aside}</aside>
      </>
    );
  return (
    <div className="flex flex-col gap-4">
      {mid}
      <section className="rounded-2xl bg-surface p-4 ring-1 ring-line ring-inset">{aside}</section>
    </div>
  );
}
