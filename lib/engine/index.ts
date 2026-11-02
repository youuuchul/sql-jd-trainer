import type { Dialect } from "@/lib/content/types";
import type { Engine } from "./types";

const engines = new Map<Dialect, Engine>();

/** 브라우저에서 방언별 엔진을 한 번만 만든다. */
export const getEngine = async (dialect: Dialect): Promise<Engine> => {
  const existing = engines.get(dialect);
  if (existing) return existing;
  let engine: Engine;
  if (dialect === "postgres") engine = new (await import("./pglite")).PgliteEngine();
  else if (dialect === "bigquery") engine = new (await import("./duckdb")).DuckdbEngine();
  else engine = new (await import("./mysql-remote")).MysqlRemoteEngine();
  engines.set(dialect, engine);
  return engine;
};

export type { Engine, QueryResult } from "./types";
export { QueryError } from "./types";
