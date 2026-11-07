import { PGlite } from "@electric-sql/pglite";
import { schemaDdl } from "../lib/engine/ddl";
import { toCell } from "../lib/engine/format";
import { singleStatement } from "../lib/engine/sql-utils";
import type { QueryResult } from "../lib/engine/types";
import type { SchemaDef } from "../lib/content/types";

const PARSERS = { 1082: (x: string) => x, 1114: (x: string) => x, 1184: (x: string) => x, 1700: (x: string) => Number(x), 20: (x: string) => Number(x), 700: (x: string) => Number(x), 701: (x: string) => Number(x) };

export const createPgliteNode = async () => {
  const db = await PGlite.create({ parsers: PARSERS });
  let loaded: string | null = null;
  return {
    async load(schema: SchemaDef) {
      if (loaded === schema.id) return;
      await db.exec(schemaDdl("postgres", schema).join(";\n") + ";");
      loaded = schema.id;
    },
    async run(sql: string): Promise<QueryResult> {
      const stmt = singleStatement(sql);
      const started = performance.now();
      // 브라우저 엔진과 같게 읽기 전용으로 돌리고 되돌린다
      await db.exec("BEGIN READ ONLY");
      try {
        const res = await db.query<unknown[]>(stmt, [], { rowMode: "array" });
        return { columns: res.fields.map((f) => f.name), rows: res.rows.map((r) => r.map((v) => toCell(v))), ms: Math.round(performance.now() - started), truncated: false };
      } finally {
        await db.exec("ROLLBACK").catch(() => undefined);
      }
    },
    close: () => db.close(),
  };
};
