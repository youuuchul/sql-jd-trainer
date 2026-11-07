import { ExpectedSchema, type Cell, type Dialect, type Expected, type Problem, type SchemaDef } from "../content/types";
import type { ProbeOutcome, ScriptOptions, ScriptRun } from "@/lib/engine/script";
import type { QueryResult } from "@/lib/engine/types";
import { compareResult, resultHash, type CompareResult } from "./compare";
import { diagnose, type Diagnosis } from "./diagnose";

/** 파이프라인 문제 채점. 머리 구획을 원본으로 바꿔 끼우고, 변수 바꿔 재실행·본문 2회 실행까지 차례로 비교한다 */

export const HEAD_START = "-- A.";
export const HEAD_END = "-- B.";

export type ScriptRunFn = (sql: string, opts: ScriptOptions) => Promise<ScriptRun>;
type Table = { columns: string[]; rows: Cell[][] };

interface HeadSplit {
  before: string[];
  head: string[];
  body: string[];
}

/** '-- A.' 줄부터 '-- B.' 로 시작하는 첫 줄 앞까지가 머리, 그 줄부터 끝이 본문. 표식이 없으면 null */
export const splitHead = (sql: string): HeadSplit | null => {
  const lines = sql.split("\n");
  const s = lines.findIndex((l) => l.trimStart().startsWith(HEAD_START));
  if (s === -1) return null;
  const e = lines.findIndex((l, i) => i > s && l.trimStart().startsWith(HEAD_END));
  if (e === -1) return null;
  return { before: lines.slice(0, s), head: lines.slice(s, e), body: lines.slice(e) };
};

const headLines = (head: string) => head.replace(/\n$/, "").split("\n");

/** 머리 구획을 head 로 바꾼다. 표식이 없으면 null */
export const replaceHead = (sql: string, head: string): string | null => {
  const sp = splitHead(sql);
  return sp ? [...sp.before, ...headLines(head), ...sp.body].join("\n") : null;
};

/** 머리 1번 + 본문 2번. 표식이 없으면 전체를 두 번 */
export const composeTwice = (sql: string): string => {
  const sp = splitHead(sql);
  if (!sp) return `${sql}\n;\n${sql}`;
  const body = sp.body.join("\n");
  return `${[...sp.before, ...sp.head].join("\n")}\n${body}\n;\n${body}`;
};

export const columnOwners = (schema: SchemaDef): Map<string, string> => {
  const m = new Map<string, string>();
  for (const t of schema.tables) for (const c of t.columns) if (!m.has(c.name.toLowerCase())) m.set(c.name.toLowerCase(), t.name);
  return m;
};

/** 채점 대상: 확인 조회가 있으면 그 결과들, 없으면 마지막 조회 문장 */
const targets = (problem: Problem, run: ScriptRun): ProbeOutcome[] =>
  problem.script?.probes.length ? run.probes : [run.last ? { result: run.last } : { error: "마지막 문장이 조회(SELECT)가 아니라 채점할 결과가 없습니다." }];

/** 여러 결과를 하나의 해시로. 결과가 하나면 기존 resultHash 와 같다 */
export const combinedHash = (outcomes: ProbeOutcome[]): string => {
  if (outcomes.length === 1 && outcomes[0].result) return resultHash(outcomes[0].result);
  return resultHash({ columns: ["h"], rows: outcomes.map((o) => [o.result ? resultHash(o.result) : "error"]) });
};

const expectedOf = (problem: Problem, table: Table): Expected => ({ ...ExpectedSchema.parse(problem.expected ?? {}), columns: table.columns, rows: table.rows });

/** 채점할 SQL: head 를 주면 머리 구획을 바꾸고, runTwice 면 본문을 두 번 */
export const gradingSql = (problem: Problem, sql: string, head?: string): string | null => {
  const s = head === undefined ? sql : replaceHead(sql, head);
  if (s === null) return null;
  return problem.script?.runTwice ? composeTwice(s) : s;
};

/** 빌드용: 정답·오답 스크립트를 채점과 같은 방식으로 돌려 채점 대상 결과를 얻는다 */
export const scriptTargets = async (run: ScriptRunFn, problem: Problem, schema: SchemaDef, sql: string, head?: string): Promise<{ run: ScriptRun; outcomes: ProbeOutcome[] }> => {
  const s = gradingSql(problem, sql, head);
  if (s === null) throw new Error(`머리 구획 표식(${HEAD_START} … ${HEAD_END})이 없습니다`);
  const r = await run(s, { probes: problem.script?.probes ?? [], columns: columnOwners(schema) });
  return { run: r, outcomes: targets(problem, r) };
};

export interface ScriptGrade {
  /** 사용자 원문 그대로 한 번 실행한 결과(표시용) */
  view: ScriptRun;
  pass: boolean;
  /** 처음 실패한 검사의 비교(통과면 기본 첫 검사) */
  cmp: CompareResult;
  /** 처음 실패한 검사의 이름. 기본 검사면 null */
  failedAt: string | null;
  diagnoses: Diagnosis[];
  /** 사용자가 머리 구획을 바꿔 채점은 원본 머리로 다시 돌렸다 */
  headSwapped: boolean;
}

const failCmp = (message: string, expectedRows: number): CompareResult => ({ pass: false, mismatches: [{ kind: "rows", message }], expectedRows, actualRows: 0, missing: [], extra: [] });

const probeTable = (sql: string) => sql.match(/\bFROM\s+([\w."`]+)/i)?.[1].replace(/[`"]/g, "").split(".").pop() ?? "";

/** 결과 목록을 기대 결과 목록과 비교해 처음 어긋난 곳을 낸다 */
const firstMismatch = (problem: Problem, outcomes: ProbeOutcome[], expected: Table[]): { i: number; cmp: CompareResult; result?: QueryResult; error?: string } | null => {
  for (let i = 0; i < expected.length; i++) {
    const o = outcomes[i];
    if (!o || o.error !== undefined) return { i, cmp: failCmp(o?.error ?? "결과가 없습니다.", expected[i].rows.length), error: o?.error ?? "" };
    const cmp = compareResult(expectedOf(problem, expected[i]), o.result);
    if (!cmp.pass) return { i, cmp, result: o.result };
  }
  return null;
};

const baseExpected = (problem: Problem): Table[] => (problem.script?.results.length ? problem.script.results : problem.expected ? [problem.expected] : []);

/** 화면 채점. 실행 오류(사용자 원문)는 ScriptError 로 던진다 */
export const gradeScript = async (run: ScriptRunFn, problem: Problem, dialect: Dialect, schema: SchemaDef, sql: string): Promise<ScriptGrade> => {
  const script = problem.script!;
  const opts: ScriptOptions = { probes: script.probes, columns: columnOwners(schema) };
  const view = await run(sql, opts);
  const expected = baseExpected(problem);
  const fail = (failedAt: string | null, cmp: CompareResult, diagnoses: Diagnosis[], headSwapped: boolean): ScriptGrade => ({ view, pass: false, cmp, failedAt, diagnoses, headSwapped });
  if (!expected.length) return fail(null, failCmp("기대 결과가 없어 채점할 수 없습니다.", 0), [], false);

  const origHead = splitHead(problem.solutions?.[dialect] ?? "");
  const userHead = splitHead(sql);
  if (origHead && !userHead)
    return fail(null, failCmp("머리 구획을 찾지 못했습니다.", expected[0]?.rows.length ?? 0), [{ label: "구획 표식 확인", explanation: `'${HEAD_START} 변수 설정' 줄과 '${HEAD_END}' 로 시작하는 주석 줄을 지우지 않아야 채점할 수 있습니다.`, source: "rule" }], false);
  const head = origHead ? origHead.head.join("\n") : undefined;
  const headSwapped = Boolean(origHead && userHead && userHead.head.join("\n").trim() !== origHead.head.join("\n").trim());
  const gradeSql = gradingSql(problem, sql, head)!;

  let base: ScriptRun;
  try {
    base = gradeSql === sql ? view : await run(gradeSql, opts);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const label = script.runTwice ? "두 번 실행 오류" : "원래 변수로 실행 오류";
    const explanation = script.runTwice ? `본문을 한 번 더 실행하면 오류가 납니다. 다시 돌려도 같은 결과가 되게 지우고 넣으세요. ${msg}` : `문제의 변수 설정으로 바꿔 돌리면 오류가 납니다. ${msg}`;
    return fail(script.runTwice ? "두 번 실행" : null, failCmp(msg, expected[0]?.rows.length ?? 0), [{ label, explanation, source: "rule" }], headSwapped);
  }

  const outcomes = targets(problem, base);
  const miss = firstMismatch(problem, outcomes, expected);
  if (miss) {
    const diagnoses: Diagnosis[] = [];
    const hash = combinedHash(outcomes);
    for (const p of problem.wrongPatterns) if (p.resultHash === hash) diagnoses.push({ label: p.label, explanation: p.explanation, source: "pattern" });
    if (!diagnoses.length && miss.error !== undefined) {
      const t = probeTable(script.probes[miss.i] ?? "");
      const missing = t && /does not exist|not exist|Table with name/i.test(miss.error);
      diagnoses.push(
        missing
          ? { label: "확인 조회 테이블 없음", explanation: `${t} 테이블이 없습니다. 단계에서 만드는 테이블 이름이 문제와 같은지 확인하세요.`, source: "rule" }
          : { label: "확인 조회 실패", explanation: miss.error, source: "rule" },
      );
    }
    if (!diagnoses.length && script.runTwice && !headSwapped && !firstMismatch(problem, targets(problem, view), expected))
      diagnoses.push({ label: "재실행하면 달라짐", explanation: "한 번 실행한 결과는 맞지만 본문을 두 번 실행하면 달라집니다. 같은 날을 다시 적재해도 중복되지 않게 지우고 넣으세요.", source: "rule" });
    if (!diagnoses.length) {
      const t = Object.entries(script.tables).find(([name, n]) => base.tables[name] !== undefined && base.tables[name] !== n);
      if (t) diagnoses.push({ label: "단계 행 수", explanation: `${t[0]} 테이블이 ${base.tables[t[0]]}행입니다. 정답 파이프라인에서는 ${t[1]}행입니다. 이 단계의 기간·중복 제거·조인 조건을 확인하세요.`, source: "rule" });
    }
    if (!diagnoses.length && miss.result) diagnoses.push(...diagnose({ ...problem, wrongPatterns: [], expected: expectedOf(problem, expected[miss.i]) }, miss.result, miss.cmp));
    return fail(script.runTwice ? "두 번 실행" : null, miss.cmp, diagnoses, headSwapped);
  }

  for (const [vi, v] of script.variants.entries()) {
    const vh = v.head[dialect];
    if (!vh || !v.results.length) continue;
    const vsql = gradingSql(problem, sql, vh)!;
    let vrun: ScriptRun;
    try {
      vrun = await run(vsql, opts);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return fail(v.label, failCmp(msg, v.results[0].rows.length), [{ label: "변수 바꿔 실행 오류", explanation: `머리 변수를 ${v.label} 로 바꿔 돌리면 오류가 납니다. ${msg}`, source: "rule" }], headSwapped);
    }
    const vo = targets(problem, vrun);
    const vmiss = firstMismatch(problem, vo, v.results);
    if (!vmiss) continue;
    const hash = combinedHash(vo);
    const diagnoses: Diagnosis[] = problem.wrongPatterns.filter((p) => p.variantHashes?.[vi] === hash).map((p) => ({ label: p.label, explanation: p.explanation, source: "pattern" as const }));
    if (!diagnoses.length)
      diagnoses.push({ label: "변수 바꿔 실행", explanation: `기본 변수로는 맞지만 ${v.label} 로 바꿔 돌리면 결과가 다릅니다. 본문에 날짜·값을 직접 쓰지 말고 머리 구획의 변수를 쓰세요.`, source: "rule" });
    return fail(v.label, vmiss.cmp, diagnoses, headSwapped);
  }

  const first = targets(problem, base)[0];
  const cmp = first?.result && expected[0] ? compareResult(expectedOf(problem, expected[0]), first.result) : failCmp("", 0);
  return { view, pass: true, cmp, failedAt: null, diagnoses: [], headSwapped };
};
