import type { SchemaDef } from "@/lib/content/types";
import { schemaDdl } from "./ddl";
import { pgRunner, type Runner } from "./runner";
import { ScriptError, type ScriptOptions, type ScriptRun } from "./script";
import { MAX_ROWS, QueryError, type Engine, type QueryResult } from "./types";

type PGliteInstance = import("@electric-sql/pglite").PGlite;

/** 날짜·숫자를 텍스트 그대로 받아 엔진 간 표현을 맞춘다. */
const PARSERS = {
  1082: (x: string) => x, // date
  1114: (x: string) => x, // timestamp
  1184: (x: string) => x, // timestamptz
  1700: (x: string) => Number(x), // numeric
  20: (x: string) => Number(x), // int8
  700: (x: string) => Number(x), // float4
  701: (x: string) => Number(x), // float8
};

export class PgliteEngine implements Engine {
  readonly dialect = "postgres" as const;
  private db: PGliteInstance | null = null;
  private runner: Runner | null = null;
  private loading: Promise<PGliteInstance> | null = null;
  private loadedSchema: string | null = null;

  async ready(): Promise<void> {
    await this.instance();
  }

  private instance(): Promise<PGliteInstance> {
    if (this.db) return Promise.resolve(this.db);
    if (!this.loading) {
      this.loading = import("@electric-sql/pglite").then(async ({ PGlite }) => {
        const db = await PGlite.create({ parsers: PARSERS });
        this.db = db;
        this.runner = pgRunner(db, MAX_ROWS);
        return db;
      });
    }
    return this.loading;
  }

  async load(schema: SchemaDef): Promise<void> {
    const db = await this.instance();
    if (this.loadedSchema === schema.id) return;
    await db.exec(schemaDdl("postgres", schema).join(";\n") + ";");
    this.loadedSchema = schema.id;
  }

  async run(sql: string): Promise<QueryResult> {
    await this.instance();
    try {
      return await this.runner!.run(sql);
    } catch (err) {
      throw new QueryError(err instanceof Error ? err.message : String(err), "postgres");
    }
  }

  async runScript(sql: string, opts: ScriptOptions): Promise<ScriptRun> {
    await this.instance();
    try {
      return await this.runner!.runScript(sql, opts);
    } catch (err) {
      if (err instanceof QueryError) throw err;
      throw new ScriptError(err instanceof Error ? err.message : String(err), "postgres", []);
    }
  }
}
