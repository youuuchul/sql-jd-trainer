import type { Cell, Dialect, SchemaDef } from "@/lib/content/types";
import type { ScriptOptions, ScriptRun } from "./script";

export interface QueryResult {
  columns: string[];
  rows: Cell[][];
  ms: number;
  truncated: boolean;
}

export class QueryError extends Error {
  constructor(message: string, public readonly dialect: Dialect) {
    super(message);
    this.name = "QueryError";
  }
}

export interface Engine {
  readonly dialect: Dialect;
  /** 엔진 바이너리 로딩. 여러 번 불러도 한 번만 수행한다. */
  ready(): Promise<void>;
  /** 스키마 시드 적재. 같은 스키마 id면 다시 적재하지 않는다. */
  load(schema: SchemaDef): Promise<void>;
  run(sql: string): Promise<QueryResult>;
  /** 여러 문장 스크립트. 파이프라인 문제만 쓴다. MySQL 은 없다 */
  runScript?(sql: string, opts: ScriptOptions): Promise<ScriptRun>;
}

export const MAX_ROWS = 500;
