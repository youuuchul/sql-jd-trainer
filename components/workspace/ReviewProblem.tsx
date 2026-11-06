"use client";
import { useCallback, useState, type ReactNode } from "react";
import { Button } from "@/components/ui-lab/components/button/Button";
import { Tabs } from "@/components/ui-lab/components/tabs/Tabs";
import { DIALECT_LABEL, REVIEW_CATEGORIES, REVIEW_CATEGORY, type Dialect, type Problem, type ReviewCategory, type ReviewDecoy, type ReviewDefect, type SchemaDef } from "@/lib/content/types";
import { QueryError, type QueryResult } from "@/lib/engine";
import { gradeReview, reviewDecoys, reviewDefects, type DefectStatus, type MarkVerdict } from "@/lib/grading";
import { useProblemProgress, type ReviewMark } from "@/lib/progress";
import { renderText } from "@/lib/text";
import { DialectSelector } from "./DialectSelector";
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
}

const VERDICT_LABEL: Record<MarkVerdict, string> = { hit: "맞음", "wrong-type": "유형 다름", false: "결함 아님" };
const STATUS_LABEL: Record<DefectStatus, string> = { found: "찾음", "wrong-type": "유형 다름", missed: "놓침" };

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

const lineTone = (mark: ReviewMark | undefined, verdict: MarkVerdict | undefined, missed: boolean) => {
  if (verdict === "hit") return "border-pass bg-pass/10";
  if (verdict === "wrong-type") return "border-warn bg-warn/10";
  if (verdict === "false") return "border-fail bg-fail/10";
  if (mark) return "border-accent bg-accent/10";
  if (missed) return "border-fail/70 bg-fail/[0.06]";
  return "border-transparent hover:bg-fg/5";
};

export function ReviewChecklist() {
  return (
    <section>
      <h2 className="mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">리뷰 체크리스트</h2>
      <ul className="space-y-1 text-[13px] leading-relaxed">
        {REVIEW_CATEGORIES.map((c) => (
          <li key={c} className="flex gap-2">
            <span className="w-[4.75rem] shrink-0 font-medium text-fg/90">{REVIEW_CATEGORY[c].label}</span>
            <span className="text-muted">{REVIEW_CATEGORY[c].cue}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ReviewProblem({ problem, schema, dialect, onDialectChange, status, execute, mode, onGraded }: ReviewProblemProps) {
  const [progress, update] = useProblemProgress(problem.id);
  const [active, setActive] = useState<number | null>(null);
  const [gradedKey, setGradedKey] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [checkSql, setCheckSql] = useState("");
  const [check, setCheck] = useState<{ dialect: Dialect; result?: QueryResult; error?: string } | null>(null);
  const [running, setRunning] = useState(false);

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

  const submit = () => {
    const g = gradeReview(review, dialect, marks);
    setGradedKey(marksKey);
    setActive(null);
    update((p) => ({ attempts: p.attempts + 1, passed: p.passed || g.pass, passedAt: g.pass && !p.passed ? new Date().toISOString() : p.passedAt }));
    onGraded?.(g.pass);
  };

  const answer = showAnswer ? gradeReview(review, dialect, marks) : null;

  return (
    <div className="flex flex-col gap-3">
      <DialectSelector value={dialect} onChange={onDialectChange} status={status} />
      <div className="rounded-xl border border-line bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
          <p className="text-xs font-semibold text-muted">검토할 쿼리 · 결함이 있는 줄을 누르고 유형을 고르세요</p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">{marks.length}줄 표시</span>
            <Button size="sm" onClick={submit} disabled={marks.length === 0}>
              채점
            </Button>
          </div>
        </div>
        <div className="bg-bg">
          <ol className="py-2 font-mono text-[12.5px] leading-relaxed">
            {lines.map((text, i) => {
              const n = i + 1;
              const mark = marks.find((m) => m.line === n);
              const verdict = mark ? verdicts?.[n] : undefined;
              const defect = showAnswer ? defectAt.get(n) : undefined;
              const decoy = showAnswer ? decoyAt.get(n) : undefined;
              return (
                <li key={n}>
                  <button
                    type="button"
                    onClick={() => setActive((a) => (a === n ? null : n))}
                    aria-pressed={Boolean(mark)}
                    aria-expanded={active === n}
                    aria-label={`${n}번째 줄`}
                    className={`flex w-full items-start gap-3 border-l-2 py-0.5 pr-3 pl-2 text-left transition-colors ${lineTone(mark, verdict, Boolean(defect && !mark))}`}
                  >
                    <span className="w-6 shrink-0 pt-px text-right text-[11px] text-muted tabular-nums select-none">{n}</span>
                    <span className="min-w-0 flex-1 break-words whitespace-pre-wrap text-fg">{highlightLine(text)}</span>
                    {mark && (
                      <span className={`ml-4 shrink-0 rounded-md px-1.5 py-0.5 font-sans text-[11px] font-medium ${verdict === "hit" ? "bg-pass/20 text-pass" : verdict === "wrong-type" ? "bg-warn/20 text-warn" : verdict === "false" ? "bg-fail/20 text-fail" : "bg-accent/20 text-accent"}`}>
                        {REVIEW_CATEGORY[mark.category].label}
                        {verdict && ` · ${VERDICT_LABEL[verdict]}`}
                        {defect && defect.category !== mark.category && ` → ${REVIEW_CATEGORY[defect.category].label}`}
                      </span>
                    )}
                    {!mark && defect && <span className="ml-4 shrink-0 rounded-md bg-fail/20 px-1.5 py-0.5 font-sans text-[11px] font-medium text-fail">놓침 · {REVIEW_CATEGORY[defect.category].label}</span>}
                    {!mark && decoy && <span className="ml-4 shrink-0 rounded-md bg-fg/10 px-1.5 py-0.5 font-sans text-[11px] text-fg/70">맞는 줄</span>}
                  </button>
                  {active === n && (
                    <div role="radiogroup" aria-label={`${n}번째 줄 결함 유형`} className="flex flex-wrap items-center gap-1.5 border-l-2 border-accent bg-surface-2 py-2 pr-3 pl-11 font-sans">
                      {REVIEW_CATEGORIES.map((c) => (
                        <button
                          key={c}
                          type="button"
                          role="radio"
                          aria-checked={mark?.category === c}
                          onClick={() => setMark(n, c)}
                          className={`h-7 rounded-lg px-2.5 text-xs font-medium transition-colors ${mark?.category === c ? "bg-accent text-white" : "bg-fg/10 text-fg/85 hover:bg-fg/15"}`}
                        >
                          {REVIEW_CATEGORY[c].label}
                        </button>
                      ))}
                      {mark && (
                        <button type="button" onClick={() => clearMark(n)} className="ml-1 h-7 px-1.5 text-xs text-muted hover:text-fg">
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
      </div>
      {grade && (
        <div className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-2.5 text-sm ${grade.pass ? "border-pass/40 bg-pass/10" : "border-fail/40 bg-fail/10"}`}>
          <span className={`inline-block h-2 w-2 rounded-full ${grade.pass ? "bg-pass" : "bg-fail"}`} aria-hidden="true" />
          <span className={`font-medium ${grade.pass ? "text-pass" : "text-fail"}`}>{grade.pass ? "정답" : "오답"}</span>
          <span className="text-muted">
            결함 {grade.total}개 중 {grade.found}개 찾음{grade.wrongType > 0 && ` · 유형 다름 ${grade.wrongType}줄`}
            {grade.falseMarks > 0 && ` · 결함 아님 ${grade.falseMarks}줄`}
          </span>
          {mode === "practice" && !showAnswer && (
            <Button size="sm" variant="secondary" className="ml-auto" onClick={() => setRevealed(true)}>
              정답 보기
            </Button>
          )}
        </div>
      )}
      <div className="rounded-xl border border-line bg-surface">
        <Tabs
          label="결과 보기"
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
                <div className="space-y-2 p-3">
                  <div className="h-36 overflow-hidden rounded-lg border border-line bg-bg">
                    <SqlEditor value={checkSql} onChange={setCheckSql} dialect={dialect} onRun={runCheck} schema={schema} />
                  </div>
                  <div className="flex justify-end">
                    <Button size="sm" onClick={runCheck} loading={running} disabled={status.state !== "ready" || !checkSql.trim()}>
                      실행 <span className="ml-1 font-mono text-[11px] opacity-70">⌘↩</span>
                    </Button>
                  </div>
                  {check?.dialect === dialect && check.error && (
                    <pre className="rounded-lg border border-fail/40 bg-fail/10 px-3 py-2 font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap text-fail">{check.error}</pre>
                  )}
                  {check?.dialect === dialect && check.result && (
                    <div className="rounded-lg border border-line">
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
                    ? [{ value: "solution", label: `올바른 쿼리 · ${DIALECT_LABEL[dialect]}`, content: <pre className="overflow-x-auto p-3 font-mono text-[12.5px] leading-relaxed">{solution}</pre> }]
                    : []),
                ]
              : []),
          ]}
        />
      </div>
      {answer && (
        <section className="space-y-4 rounded-xl border border-line bg-surface p-4">
          <div className="space-y-3">
            <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">결함 {answer.total}개</h2>
            <ul className="space-y-3">
              {answer.defects.map(({ defect, status: st }) => (
                <li key={defect.title} className="text-[13px] leading-relaxed">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-md bg-fail/15 px-1.5 py-0.5 text-[11px] font-medium text-fail">{REVIEW_CATEGORY[defect.category].label}</span>
                    <span className="font-mono text-[11px] text-muted">줄 {(defect.lines[dialect] ?? []).join(", ")}</span>
                    <span className={`text-[11px] font-medium ${st === "found" ? "text-pass" : st === "wrong-type" ? "text-warn" : "text-muted"}`}>{STATUS_LABEL[st]}</span>
                  </div>
                  <p className="mt-1 font-medium text-fg">{defect.title}</p>
                  <p className="text-fg/80">{defect.explanation}</p>
                </li>
              ))}
            </ul>
          </div>
          {decoyAt.size > 0 && (
            <div className="space-y-2 border-t border-line pt-3">
              <h3 className="text-xs font-semibold text-muted">맞는 줄</h3>
              <ul className="space-y-1.5">
                {reviewDecoys(review, dialect).map((d) => (
                  <li key={d.explanation} className="text-[13px] leading-relaxed text-fg/80">
                    <span className="mr-1.5 font-mono text-[11px] text-muted">줄 {(d.lines[dialect] ?? []).join(", ")}</span>
                    {d.explanation}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {problem.explanation && (
            <div className="space-y-3 border-t border-line pt-3">
              <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">해설</h3>
              {renderText(problem.explanation)}
              {problem.dialectNotes?.[dialect] && <p className="text-[12.5px] leading-relaxed text-muted">{problem.dialectNotes[dialect]}</p>}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
