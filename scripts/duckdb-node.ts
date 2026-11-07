import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { BQ_MACROS } from "../lib/engine/bq-shim";
import { schemaDdl } from "../lib/engine/ddl";
import { duckRunner } from "../lib/engine/runner";
import type { SchemaDef } from "../lib/content/types";

const require = createRequire(pathToFileURL(__filename).href);

/** Node 전용 DuckDB(blocking 바인딩). 브라우저 엔진과 같은 실행 경로(lib/engine/runner)를 쓰고 행 수만 자르지 않는다 */
export const createDuckdbNode = async () => {
  const duckdb = require("@duckdb/duckdb-wasm/blocking") as typeof import("@duckdb/duckdb-wasm/blocking");
  const dist = path.dirname(require.resolve("@duckdb/duckdb-wasm"));
  const bundles = {
    mvp: { mainModule: path.join(dist, "duckdb-mvp.wasm"), mainWorker: path.join(dist, "duckdb-node-mvp.worker.cjs") },
    eh: { mainModule: path.join(dist, "duckdb-eh.wasm"), mainWorker: path.join(dist, "duckdb-node-eh.worker.cjs") },
  };
  const db = await duckdb.createDuckDB(bundles, new duckdb.VoidLogger(), duckdb.NODE_RUNTIME);
  await db.instantiate();
  const conn = db.connect();
  for (const m of BQ_MACROS) conn.query(m);
  const runner = duckRunner(conn, Infinity);
  let loaded: string | null = null;
  return {
    load(schema: SchemaDef) {
      if (loaded === schema.id) return;
      for (const stmt of schemaDdl("bigquery", schema)) conn.query(stmt);
      loaded = schema.id;
    },
    run: runner.run,
    runScript: runner.runScript,
    close() {
      conn.close();
    },
  };
};
