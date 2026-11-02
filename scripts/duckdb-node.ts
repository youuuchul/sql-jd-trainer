import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { arrowToResult } from "../lib/engine/arrow";
import { BQ_MACROS, bqToDuckdb } from "../lib/engine/bq-shim";
import { schemaDdl } from "../lib/engine/ddl";
import { singleStatement } from "../lib/engine/sql-utils";
import type { QueryResult } from "../lib/engine/types";
import type { SchemaDef } from "../lib/content/types";

const require = createRequire(pathToFileURL(__filename).href);

/** Node 전용 DuckDB(blocking 바인딩). 브라우저 어댑터와 같은 shim·변환을 쓴다. */
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
  let loaded: string | null = null;
  return {
    load(schema: SchemaDef) {
      if (loaded === schema.id) return;
      for (const stmt of schemaDdl("bigquery", schema)) conn.query(stmt);
      loaded = schema.id;
    },
    run(sql: string): QueryResult {
      const started = performance.now();
      const table = conn.query(bqToDuckdb(singleStatement(sql)));
      return arrowToResult(table, Math.round(performance.now() - started));
    },
    close() {
      conn.close();
    },
  };
};
