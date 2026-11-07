import type { Table } from "apache-arrow";
import { arrowToResult } from "./arrow";
import { bqToDuckdb } from "./bq-shim";
import { toCell } from "./format";
import { runScript, type ScriptDriver, type ScriptOptions, type ScriptRun } from "./script";
import { singleStatement } from "./sql-utils";
import type { QueryResult } from "./types";

/** 브라우저 엔진과 빌드용 노드 실행기가 같이 쓰는 실행 경로. 실행마다 트랜잭션을 열고 되돌린다 */

type PgLike = {
  exec(sql: string): Promise<unknown>;
  query<T>(sql: string, params: unknown[], opts: { rowMode: "array" }): Promise<{ rows: T[]; fields: { name: string }[]; affectedRows?: number }>;
};

type Maybe<T> = T | Promise<T>;
type DuckLike = {
  query(sql: string): Maybe<Table>;
  prepare(sql: string): Maybe<{ query(): Maybe<Table>; close(): Maybe<void> }>;
};

export interface Runner {
  run(sql: string): Promise<QueryResult>;
  runScript(sql: string, opts: ScriptOptions): Promise<ScriptRun>;
}

const pgDriver = (db: PgLike): ScriptDriver => ({
  dialect: "postgres",
  control: async (sql) => void (await db.exec(sql)),
  async guarded(f) {
    await db.exec("SAVEPOINT sjt_probe");
    try {
      const out = await f();
      await db.exec("RELEASE SAVEPOINT sjt_probe");
      return out;
    } catch (e) {
      await db.exec("ROLLBACK TO SAVEPOINT sjt_probe");
      throw e;
    }
  },
  async query(sql, limit) {
    const started = performance.now();
    const res = await db.query<unknown[]>(sql, [], { rowMode: "array" });
    const rows = res.rows.slice(0, limit).map((r) => r.map((v) => toCell(v)));
    return {
      result: { columns: res.fields.map((f) => f.name), rows, ms: Math.round(performance.now() - started), truncated: res.rows.length > limit },
      count: res.rows.length,
      affected: res.affectedRows ?? null,
    };
  },
});

/** prepare 는 여러 문장을 거부한다. 분할기가 놓친 문장이 엔진에서 함께 실행되지 않게 하는 두 번째 방어선 */
const duckDriver = (conn: DuckLike): ScriptDriver => ({
  dialect: "bigquery",
  control: async (sql) => void (await conn.query(sql)),
  guarded: (f) => f(),
  async query(sql, limit) {
    const started = performance.now();
    const stmt = await conn.prepare(sql);
    try {
      const table = await stmt.query();
      const result = arrowToResult(table, Math.round(performance.now() - started), limit);
      const countCol = table.schema.fields.length === 1 && table.schema.fields[0].name === "Count";
      return { result, count: table.numRows, affected: countCol && table.numRows === 1 ? Number(table.getChildAt(0)?.get(0)) : null };
    } finally {
      await stmt.close();
    }
  },
});

const single = async (driver: ScriptDriver, sql: string, limit: number): Promise<QueryResult> => {
  const stmt = singleStatement(sql);
  await driver.control("BEGIN");
  try {
    return (await driver.query(driver.dialect === "bigquery" ? bqToDuckdb(stmt) : stmt, limit)).result;
  } finally {
    await driver.control("ROLLBACK").catch(() => undefined);
  }
};

/** PostgreSQL(PGlite). 한 문장 실행은 읽기 전용, 스크립트는 쓰기 트랜잭션 뒤 되돌림 */
export const pgRunner = (db: PgLike, limit: number): Runner => {
  const driver = pgDriver(db);
  const readOnly: ScriptDriver = { ...driver, control: async (sql) => void (await db.exec(sql === "BEGIN" ? "BEGIN READ ONLY" : sql)) };
  return {
    run: (sql) => single(readOnly, sql, limit),
    runScript: (sql, opts) => runScript(driver, sql, opts, limit),
  };
};

/** BigQuery 흉내(DuckDB). 한 문장도 스크립트도 실행마다 되돌린다 */
export const duckRunner = (conn: DuckLike, limit: number): Runner => {
  const driver = duckDriver(conn);
  return {
    run: (sql) => single(driver, sql, limit),
    runScript: (sql, opts) => runScript(driver, sql, opts, limit),
  };
};
