import type { SchemaDef } from "@/lib/content/types";
import { BQ_MACROS } from "./bq-shim";
import { schemaDdl } from "./ddl";
import { duckRunner, type Runner } from "./runner";
import { ScriptError, type ScriptOptions, type ScriptRun } from "./script";
import { MAX_ROWS, QueryError, type Engine, type QueryResult } from "./types";

type AsyncDuckDB = import("@duckdb/duckdb-wasm").AsyncDuckDB;
type AsyncConnection = import("@duckdb/duckdb-wasm").AsyncDuckDBConnection;

/** 브라우저용 DuckDB-WASM. BigQuery 방언은 bq-shim으로 변환해서 실행한다. */
export class DuckdbEngine implements Engine {
  readonly dialect = "bigquery" as const;
  private db: AsyncDuckDB | null = null;
  private conn: AsyncConnection | null = null;
  private runner: Runner | null = null;
  private loading: Promise<AsyncConnection> | null = null;
  private loadedSchema: string | null = null;

  async ready(): Promise<void> {
    await this.connection();
  }

  private connection(): Promise<AsyncConnection> {
    if (this.conn) return Promise.resolve(this.conn);
    if (!this.loading) {
      this.loading = (async () => {
        const duckdb = await import("@duckdb/duckdb-wasm");
        const bundles = duckdb.getJsDelivrBundles();
        const bundle = await duckdb.selectBundle(bundles);
        const workerUrl = URL.createObjectURL(new Blob([`importScripts("${bundle.mainWorker}");`], { type: "text/javascript" }));
        const worker = new Worker(workerUrl);
        const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker);
        await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
        URL.revokeObjectURL(workerUrl);
        const conn = await db.connect();
        for (const m of BQ_MACROS) await conn.query(m);
        this.db = db;
        this.conn = conn;
        this.runner = duckRunner(conn, MAX_ROWS);
        return conn;
      })();
    }
    return this.loading;
  }

  async load(schema: SchemaDef): Promise<void> {
    const conn = await this.connection();
    if (this.loadedSchema === schema.id) return;
    for (const stmt of schemaDdl("bigquery", schema)) await conn.query(stmt);
    this.loadedSchema = schema.id;
  }

  /** 쓰기 문장(CREATE·DROP 등)이 연결에 남아 다음 실행·다른 문제에 보이지 않게 실행마다 되돌린다 */
  async run(sql: string): Promise<QueryResult> {
    await this.connection();
    try {
      return await this.runner!.run(sql);
    } catch (err) {
      throw new QueryError(err instanceof Error ? err.message : String(err), "bigquery");
    }
  }

  async runScript(sql: string, opts: ScriptOptions): Promise<ScriptRun> {
    await this.connection();
    try {
      return await this.runner!.runScript(sql, opts);
    } catch (err) {
      if (err instanceof QueryError) throw err;
      throw new ScriptError(err instanceof Error ? err.message : String(err), "bigquery", []);
    }
  }
}
