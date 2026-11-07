import type { Dialect } from "@/lib/content/types";
import { bqToDuckdb } from "./bq-shim";
import { QueryError, type QueryResult } from "./types";

/** 여러 문장 스크립트 실행기. 문장을 직접 나눠 한 트랜잭션 안에서 차례로 돌리고 확인 조회까지 마친 뒤 되돌린다 */

export type StatementKind = "SELECT" | "CREATE TABLE" | "INSERT" | "DELETE" | "UPDATE" | "DROP TABLE" | "TRUNCATE" | "DECLARE" | "SET";

export interface ScriptStatement {
  /** 1부터 */
  index: number;
  /** 문장이 시작하는 원문 줄(1부터) */
  line: number;
  kind: StatementKind;
  /** 대상 테이블(소문자, 마지막 이름 조각) */
  table?: string;
  /** 엔진에 보낼 문장. DECLARE·SET 은 값 치환으로 소비돼 비어 있다 */
  sql: string;
}

export interface StatementLog {
  index: number;
  line: number;
  kind: StatementKind;
  table?: string;
  /** 조회는 결과 행 수, 적재·삭제·수정은 영향 행 수, CREATE TABLE … AS 는 만든 행 수. 해당 없으면 null */
  rows: number | null;
}

export type ProbeOutcome = { result: QueryResult; error?: undefined } | { result?: undefined; error: string };

export interface ScriptRun {
  log: StatementLog[];
  /** 마지막 조회 문장 결과(표시용, 행 수 제한) */
  last: QueryResult | null;
  /** 확인 조회 결과(채점용, 행 수 제한 없음) */
  probes: ProbeOutcome[];
  /** 스크립트가 만든 테이블 중 끝까지 남은 것의 행 수 */
  tables: Record<string, number>;
  ms: number;
}

export interface ScriptOptions {
  probes: string[];
  /** BigQuery 변수 이름과 겹치면 안 되는 컬럼 이름 → 테이블 이름 */
  columns: Map<string, string>;
}

/** 문장 하나를 실행하는 엔진 어댑터. count 는 행 수 제한 전 전체 결과 행 수, affected 는 영향 행 수 */
export interface ScriptDriver {
  dialect: "postgres" | "bigquery";
  control(sql: "BEGIN" | "ROLLBACK"): Promise<void>;
  /** 실패해도 트랜잭션을 계속 쓸 수 있게 감싼다(PostgreSQL 은 오류 한 번에 트랜잭션 전체가 중단된다) */
  guarded<T>(f: () => Promise<T>): Promise<T>;
  query(sql: string, limit: number): Promise<{ result: QueryResult; count: number; affected: number | null }>;
}

export class ScriptError extends QueryError {
  constructor(
    message: string,
    dialect: Dialect,
    public readonly log: StatementLog[],
  ) {
    super(message, dialect);
    this.name = "ScriptError";
  }
}

const isIdent = (ch: string | undefined) => ch !== undefined && /[\w$]/.test(ch);

/**
 * 세미콜론으로 문장을 나눈다. 문자열('…' 의 '' 이스케이프, "…", `…`, $태그$…$태그$)과 주석(--, /* *\/)을 건너뛴다.
 * 주석은 공백으로 바꿔 엔진에 보내는 문장과 검사한 문장이 같게 한다. 백슬래시는 이스케이프로 보지 않는다(PostgreSQL·DuckDB 표준 문자열).
 */
export const splitStatements = (sql: string): { text: string; line: number }[] => {
  const out: { text: string; line: number }[] = [];
  let cur = "";
  let startLine = 1;
  let line = 1;
  let i = 0;
  const push = () => {
    if (cur.trim()) out.push({ text: cur.trim(), line: startLine + (cur.slice(0, cur.length - cur.trimStart().length).match(/\n/g)?.length ?? 0) });
    cur = "";
    startLine = line;
  };
  while (i < sql.length) {
    const ch = sql[i];
    const next = sql[i + 1];
    if (ch === "'" || ch === '"' || ch === "`") {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === ch) {
          if (sql[j + 1] === ch && ch !== "`") {
            j += 2;
            continue;
          }
          break;
        }
        j++;
      }
      const piece = sql.slice(i, j + 1);
      line += piece.match(/\n/g)?.length ?? 0;
      cur += piece;
      i = j + 1;
      continue;
    }
    if (ch === "$" && !isIdent(sql[i - 1])) {
      const tag = sql.slice(i).match(/^\$([A-Za-z_]\w*)?\$/);
      if (tag) {
        const end = sql.indexOf(tag[0], i + tag[0].length);
        const stop = end === -1 ? sql.length : end + tag[0].length;
        const piece = sql.slice(i, stop);
        line += piece.match(/\n/g)?.length ?? 0;
        cur += piece;
        i = stop;
        continue;
      }
    }
    if (ch === "-" && next === "-") {
      while (i < sql.length && sql[i] !== "\n") i++;
      cur += " ";
      continue;
    }
    if (ch === "/" && next === "*") {
      const end = sql.indexOf("*/", i + 2);
      const stop = end === -1 ? sql.length : end + 2;
      const n = sql.slice(i, stop).match(/\n/g)?.length ?? 0;
      line += n;
      cur += n ? "\n".repeat(n) : " ";
      i = stop;
      continue;
    }
    if (ch === ";") {
      push();
      i++;
      continue;
    }
    if (ch === "\n") line++;
    cur += ch;
    i++;
  }
  push();
  return out;
};

const NAME = String.raw`((?:[\w$]+|"(?:[^"]|"")+"|\x60[^\x60]+\x60)(?:\s*\.\s*(?:[\w$]+|"(?:[^"]|"")+"|\x60[^\x60]+\x60))*)`;
const tableName = (raw: string): string => {
  const parts = raw.match(/[\w$]+|"(?:[^"]|"")+"|`[^`]+`/g) ?? [raw];
  const last = parts[parts.length - 1].replace(/^[`"]|[`"]$/g, "");
  // 백틱 하나에 `p.d.t` 로 묶인 이름
  return (last.split(".").pop() ?? last).toLowerCase();
};

const RULES: { kind: StatementKind; re: RegExp }[] = [
  { kind: "SELECT", re: /^(?:SELECT|WITH|VALUES|\()/i },
  { kind: "CREATE TABLE", re: new RegExp(String.raw`^CREATE\s+(?:OR\s+REPLACE\s+)?(?:(?:TEMP|TEMPORARY)\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?${NAME}`, "i") },
  { kind: "INSERT", re: new RegExp(String.raw`^INSERT\s+INTO\s+${NAME}`, "i") },
  { kind: "DELETE", re: new RegExp(String.raw`^DELETE\s+FROM\s+${NAME}`, "i") },
  { kind: "UPDATE", re: new RegExp(String.raw`^UPDATE\s+${NAME}`, "i") },
  { kind: "DROP TABLE", re: new RegExp(String.raw`^DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?${NAME}`, "i") },
  { kind: "TRUNCATE", re: new RegExp(String.raw`^TRUNCATE\s+(?:TABLE\s+)?${NAME}`, "i") },
];

const ALLOWED = "조회(SELECT·WITH), CREATE TABLE, INSERT INTO, DELETE FROM, UPDATE, DROP TABLE, TRUNCATE";

const reject = (index: number, line: number, text: string, dialect: Dialect): never => {
  const word = (text.match(/^\s*(\w+)/)?.[1] ?? text.slice(0, 12)).toUpperCase();
  const where = `${index}번째 문장(${line}행 ${word})`;
  if (/^(BEGIN|START|COMMIT|ROLLBACK|SAVEPOINT|RELEASE|END|ABORT)$/.test(word))
    throw new QueryError(`${where}: 트랜잭션 제어 문장은 쓸 수 없습니다. 실행이 끝나면 모든 변경을 자동으로 되돌립니다.`, dialect);
  const extra = dialect === "bigquery" ? ", DECLARE, 선언한 변수의 SET" : "";
  throw new QueryError(`${where}: 실행할 수 없는 문장입니다. ${ALLOWED}${extra} 만 쓸 수 있습니다.`, dialect);
};

/** BigQuery DECLARE 의 이름·자료형·기본값 */
const parseDeclare = (text: string): { names: string[]; type: string | null; value: string | null } | null => {
  const m = text.match(/^DECLARE\s+([\s\S]+)$/i);
  if (!m) return null;
  const [left, value] = m[1].split(/\s+DEFAULT\s+/i, 2).length === 2 ? [m[1].slice(0, m[1].search(/\s+DEFAULT\s+/i)), m[1].replace(/^[\s\S]*?\s+DEFAULT\s+/i, "")] : [m[1], null];
  const nm = left.trim().match(/^([A-Za-z_]\w*(?:\s*,\s*[A-Za-z_]\w*)*)\s*([\s\S]*)$/);
  if (!nm) return null;
  const type = nm[2].trim() || null;
  if (!type && value === null) return null;
  return { names: nm[1].split(",").map((s) => s.trim().toLowerCase()), type, value: value?.trim() ?? null };
};

/**
 * BigQuery 변수를 값 치환으로 바꾼다. 엔진 변수(SET VARIABLE)는 롤백되지 않아 문제 사이에 샌다.
 * 문자열·따옴표 식별자·점 뒤(p.x)·함수 이름·AS 별칭 자리는 바꾸지 않는다.
 */
const substitute = (text: string, vars: Map<string, string>): string => {
  if (!vars.size) return text;
  const names = [...vars.keys()].sort((a, b) => b.length - a.length).join("|");
  const re = new RegExp(String.raw`'(?:[^']|'')*'|"(?:[^"]|"")*"|\x60[^\x60]*\x60|(?<![.\w$])(?<!\bAS\s+)(${names})(?![\w$(])`, "gi");
  return text.replace(re, (m, name?: string) => (name ? `(${vars.get(name.toLowerCase())})` : m));
};

/** 문장을 나누고 허용 목록으로 검사한다. BigQuery 는 DECLARE·SET 을 값 치환으로 소비하고 shim 으로 바꾼다 */
export const prepareScript = (dialect: "postgres" | "bigquery", sql: string, columns: Map<string, string>): ScriptStatement[] => {
  const vars = new Map<string, string>();
  const out: ScriptStatement[] = [];
  splitStatements(sql).forEach(({ text, line }, i) => {
    const index = i + 1;
    if (dialect === "bigquery" && /^DECLARE\b/i.test(text)) {
      const d = parseDeclare(text);
      if (!d) throw new QueryError(`${index}번째 문장(${line}행 DECLARE): 'DECLARE 이름 자료형' 또는 'DECLARE 이름 DEFAULT 값' 형태로 쓰세요.`, dialect);
      for (const n of d.names) {
        const owner = columns.get(n);
        if (owner) throw new QueryError(`${index}번째 문장(${line}행 DECLARE): 변수 이름 ${n} 이 ${owner}.${n} 컬럼과 겹칩니다. 컬럼과 다른 이름을 쓰세요.`, dialect);
        vars.set(n, d.value !== null ? substitute(d.value, vars) : `CAST(NULL AS ${d.type})`);
      }
      out.push({ index, line, kind: "DECLARE", sql: "" });
      return;
    }
    if (dialect === "bigquery" && /^SET\b/i.test(text)) {
      const s = text.match(/^SET\s+([A-Za-z_]\w*)\s*=\s*([\s\S]+)$/i);
      const name = s?.[1].toLowerCase();
      if (!s || !name || !vars.has(name)) throw new QueryError(`${index}번째 문장(${line}행 SET): DECLARE 로 먼저 선언한 변수에만 값을 넣을 수 있습니다.`, dialect);
      vars.set(name, substitute(s[2], vars));
      out.push({ index, line, kind: "SET", sql: "" });
      return;
    }
    const rule = RULES.find((r) => r.re.test(text));
    if (!rule) reject(index, line, text, dialect);
    const m = text.match(rule!.re);
    const body = dialect === "bigquery" ? bqToDuckdb(substitute(text, vars)) : text;
    out.push({ index, line, kind: rule!.kind, ...(m?.[1] ? { table: tableName(m[1]) } : {}), sql: body });
  });
  if (!out.some((s) => s.sql)) throw new QueryError("실행할 문장이 없습니다.", dialect);
  return out;
};

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** 한 트랜잭션 안에서 스크립트 → 확인 조회 → 만든 테이블 행 수를 차례로 얻고 되돌린다 */
export const runScript = async (driver: ScriptDriver, sql: string, opts: ScriptOptions, maxRows: number): Promise<ScriptRun> => {
  const dialect = driver.dialect;
  const stmts = prepareScript(dialect, sql, opts.columns);
  const started = performance.now();
  const log: StatementLog[] = [];
  const created: string[] = [];
  let last: QueryResult | null = null;
  await driver.control("BEGIN");
  try {
    for (const st of stmts) {
      const entry: StatementLog = { index: st.index, line: st.line, kind: st.kind, ...(st.table ? { table: st.table } : {}), rows: null };
      if (!st.sql) {
        log.push(entry);
        continue;
      }
      try {
        const { result, count, affected } = await driver.query(st.sql, maxRows);
        if (st.kind === "SELECT") {
          last = result;
          entry.rows = count;
        } else if (st.kind === "INSERT" || st.kind === "DELETE" || st.kind === "UPDATE") entry.rows = affected;
        else if (st.kind === "CREATE TABLE" && st.table) {
          if (!created.includes(st.table)) created.push(st.table);
          if (/\bAS\b/i.test(st.sql)) entry.rows = (await driver.query(`SELECT COUNT(*) FROM ${st.table}`, 1)).result.rows[0]?.[0] as number;
        }
      } catch (e) {
        throw new ScriptError(`${st.index}번째 문장(${st.line}행 ${st.kind}${st.table ? ` ${st.table}` : ""})에서 오류: ${errorText(e)}`, dialect, log);
      }
      log.push(entry);
    }
    const probes: ProbeOutcome[] = [];
    for (const p of opts.probes) {
      try {
        probes.push({ result: (await driver.guarded(() => driver.query(dialect === "bigquery" ? bqToDuckdb(p) : p, Infinity))).result });
      } catch (e) {
        probes.push({ error: errorText(e) });
      }
    }
    const tables: Record<string, number> = {};
    for (const t of created) {
      try {
        tables[t] = Number((await driver.guarded(() => driver.query(`SELECT COUNT(*) FROM ${t}`, 1))).result.rows[0]?.[0]);
      } catch {
        // 스크립트 안에서 지운 테이블
      }
    }
    return { log, last, probes, tables, ms: Math.round(performance.now() - started) };
  } finally {
    await driver.control("ROLLBACK").catch(() => undefined);
  }
};
