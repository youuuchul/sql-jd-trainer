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
      const started = performance.now();
      const res = await db.query<unknown[]>(singleStatement(sql), [], { rowMode: "array" });
      return { columns: res.fields.map((f) => f.name), rows: res.rows.map((r) => r.map((v) => toCell(v))), ms: Math.round(performance.now() - started), truncated: false };
    },
    close: () => db.close(),
  };
};
