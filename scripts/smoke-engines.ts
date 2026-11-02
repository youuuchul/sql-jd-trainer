import { createDuckdbNode } from "./duckdb-node";
import { createPgliteNode } from "./pglite-node";
import type { SchemaDef } from "../lib/content/types";

const schema: SchemaDef = {
  id: "smoke",
  title: "smoke",
  domain: "test",
  timezone: "Asia/Seoul",
  notes: [],
  metrics: [],
  tables: [
    {
      name: "t",
      columns: [
        { name: "id", type: "int" },
        { name: "big", type: "bigint" },
        { name: "amt", type: "decimal" },
        { name: "d", type: "date" },
        { name: "ts", type: "timestamp" },
        { name: "ok", type: "bool" },
        { name: "s", type: "text" },
      ],
      rows: [
        [1, 9007199254740, 1234.5, "2024-03-01", "2024-03-01 09:30:00", true, "a'b"],
        [2, 5, 10, "2024-03-31", "2024-03-31 23:59:59", false, null],
      ],
    },
  ],
};

const pgSql = `SELECT id, big, amt, d, ts, ok, s, SUM(amt) OVER () AS total, d - DATE '2024-02-01' AS dd, TO_CHAR(d, 'YYYY-MM') AS ym, DATE_TRUNC('month', ts) AS mon, 7/2 AS intdiv, ROUND(AVG(amt) OVER (), 2) AS avg FROM t ORDER BY id`;
const bqSql = `SELECT id, big, amt, d, ts, ok, s, SUM(amt) OVER () AS total, DATE_DIFF(d, DATE '2024-02-01', DAY) AS dd, FORMAT_DATE('%Y-%m', d) AS ym, DATE_TRUNC(ts, MONTH) AS mon, SAFE_DIVIDE(7, 2) AS intdiv, ROUND(AVG(amt) OVER (), 2) AS avg, COUNTIF(ok) OVER () AS cnt_ok, CAST(amt AS INT64) AS amt_int, DATE_ADD(d, INTERVAL 7 DAY) AS d7 FROM t ORDER BY id`;

const main = async () => {
const pg = await createPgliteNode();
await pg.load(schema);
console.log("PG", JSON.stringify(await pg.run(pgSql)));
await pg.close();

const duck = await createDuckdbNode();
duck.load(schema);
console.log("BQ", JSON.stringify(duck.run(bqSql)));
duck.close();
};
main().catch((e) => { console.error(e); process.exit(1); });
