import { PGlite } from "@electric-sql/pglite";
import { schemaDdl } from "../lib/engine/ddl";
import { pgRunner } from "../lib/engine/runner";
import type { SchemaDef } from "../lib/content/types";

const PARSERS = { 1082: (x: string) => x, 1114: (x: string) => x, 1184: (x: string) => x, 1700: (x: string) => Number(x), 20: (x: string) => Number(x), 700: (x: string) => Number(x), 701: (x: string) => Number(x) };

/** Node 전용 PGlite. 브라우저 엔진과 같은 실행 경로(lib/engine/runner)를 쓰고 행 수만 자르지 않는다 */
export const createPgliteNode = async () => {
  const db = await PGlite.create({ parsers: PARSERS });
  const runner = pgRunner(db, Infinity);
  let loaded: string | null = null;
  return {
    async load(schema: SchemaDef) {
      if (loaded === schema.id) return;
      await db.exec(schemaDdl("postgres", schema).join(";\n") + ";");
      loaded = schema.id;
    },
    run: runner.run,
    runScript: runner.runScript,
    close: () => db.close(),
  };
};
