/**
 * 엔진 격리 확인. 실행마다 쓰기 문장이 되돌려져 다음 실행·다른 문제에 남지 않는지 본다.
 * 실행: npx tsx scripts/check-engine.ts
 */
import type { SchemaDef } from "../lib/content/types";
import { createDuckdbNode } from "./duckdb-node";
import { createPgliteNode } from "./pglite-node";

const schema: SchemaDef = {
  id: "check",
  title: "check",
  domain: "test",
  timezone: "Asia/Seoul",
  notes: [],
  metrics: [],
  locked: false,
  tables: [
    {
      name: "seed",
      columns: [
        { name: "d", type: "date" },
        { name: "v", type: "int" },
      ],
      rows: [
        ["2026-10-01", 1],
        ["2026-10-02", 2],
        ["2026-11-01", 3],
      ],
    },
  ],
};

type Runner = { run: (sql: string) => unknown };

let failures = 0;
const check = (label: string, ok: boolean, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "통과" : "실패"} ${label}${detail ? ` (${detail})` : ""}`);
};
const attempt = async (r: Runner, sql: string): Promise<{ rows?: unknown[][]; error?: string }> => {
  try {
    return { rows: ((await r.run(sql)) as { rows: unknown[][] }).rows };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
};

const isolation = async (name: string, r: Runner) => {
  await attempt(r, "DROP TABLE seed");
  const seed = await attempt(r, "SELECT COUNT(*) AS n FROM seed");
  check(`${name} 시드 DROP 뒤 다음 실행에서 시드가 그대로`, seed.rows?.[0]?.[0] === 3, JSON.stringify(seed));
  await attempt(r, "CREATE TABLE leak AS SELECT 1 AS x");
  const leak = await attempt(r, "SELECT * FROM leak");
  check(`${name} CREATE TABLE 이 다음 실행에 남지 않음`, Boolean(leak.error), JSON.stringify(leak));
  await attempt(r, "CREATE TEMP TABLE seed AS SELECT 99 AS z");
  const shadow = await attempt(r, "SELECT COUNT(*) AS n FROM seed");
  check(`${name} 시드 이름을 가리는 임시 테이블이 남지 않음`, shadow.rows?.[0]?.[0] === 3, JSON.stringify(shadow));
};

const main = async () => {
  const pg = await createPgliteNode();
  await pg.load(schema);
  const duck = await createDuckdbNode();
  duck.load(schema);
  await isolation("PG", pg);
  await isolation("BQ", duck);
  duck.close();
  await pg.close();
  console.log(failures ? `\n실패 ${failures}건` : "\n모두 통과");
  process.exit(failures ? 1 : 0);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
