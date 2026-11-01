import type { Cell, Dialect, SchemaDef } from "@/lib/content/types";

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
}

export const MAX_ROWS = 500;
