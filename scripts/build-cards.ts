/**
 * 하루 카드(content/cards/*.json)의 빈칸에 정답을 넣어 실제 엔진에서 실행하고 result 를 채운다.
 * common 카드는 세 방언 결과가 같아야 한다. answers 의 모든 후보가 같은 결과를 내야 한다.
 * 실행: MYSQL_URL=mysql://root:sjt@127.0.0.1:3307/ npx tsx scripts/build-cards.ts [덱 파일명 접두사 ...]
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { CardDeckSchema, type Dialect, type SchemaDef } from "../lib/content/types";
import { compareResult } from "../lib/grading/compare";
import type { QueryResult } from "../lib/engine/types";
import { createDuckdbNode } from "./duckdb-node";
import { createMysqlNode } from "./mysql-node";
import { createPgliteNode } from "./pglite-node";

const DIR = path.join(process.cwd(), "content", "cards");
const BLANK = "___";
const filters = process.argv.slice(2);

const EMPTY_SCHEMA: SchemaDef = {
  id: "cards",
  title: "cards",
  domain: "cards",
  timezone: "Asia/Seoul",
  notes: [],
  metrics: [],
  locked: false,
  tables: [{ name: "card_dummy", columns: [{ name: "x", type: "int" }], rows: [[1]] }],
};

const main = async () => {
  const pg = await createPgliteNode();
  const duck = await createDuckdbNode();
  const mysql = process.env.MYSQL_URL ? createMysqlNode() : null;
  await pg.load(EMPTY_SCHEMA);
  duck.load(EMPTY_SCHEMA);

  const run = async (dialect: Dialect, sql: string): Promise<QueryResult | Error> => {
    try {
      if (dialect === "postgres") return await pg.run(sql);
      if (dialect === "bigquery") return duck.run(sql);
      return await mysql!.run(EMPTY_SCHEMA, sql);
    } catch (e) {
      return e instanceof Error ? e : new Error(String(e));
    }
  };

  const lines: string[] = [];
  let failures = 0;
  const seen = new Set<string>();
  const files = readdirSync(DIR).filter((f) => f.endsWith(".json") && (!filters.length || filters.some((p) => f.startsWith(p)))).sort();
  for (const f of files) {
    const file = path.join(DIR, f);
    const raw = JSON.parse(readFileSync(file, "utf-8"));
    const deck = CardDeckSchema.parse(raw);
    const outCards = [];
    for (const card of deck.cards) {
      const fail = (msg: string) => {
        failures++;
        lines.push(`${card.id.padEnd(32)} ${msg}`);
      };
      if (seen.has(card.id)) fail("id 중복");
      seen.add(card.id);
      const blanks = card.template.split(BLANK).length - 1;
      if (blanks !== 1) {
        fail(`빈칸 ___ 이 ${blanks}개`);
        outCards.push(card);
        continue;
      }
      const dialects: Dialect[] = card.dialect === "common" ? (mysql ? ["postgres", "bigquery", "mysql"] : ["postgres", "bigquery"]) : [card.dialect];
      if (card.dialect === "mysql" && !mysql) {
        lines.push(`${card.id.padEnd(32)} MySQL 건너뜀`);
        outCards.push(card);
        continue;
      }
      let base: QueryResult | null = null;
      let ok = true;
      for (const answer of card.answers) {
        const sql = card.template.replace(BLANK, answer);
        for (const d of dialects) {
          const res = await run(d, sql);
          if (res instanceof Error) {
            ok = false;
            fail(`${d} 실패 (답 "${answer}"): ${res.message.split("\n")[0].slice(0, 120)}`);
            continue;
          }
          if (res.rows.length === 0 || res.rows.length > 8) fail(`${d} 결과 ${res.rows.length}행 (1~8행이어야 함)`);
          if (!base) {
            base = res;
            continue;
          }
          const cmp = compareResult({ columns: base.columns, rows: base.rows, ordered: true, tolerance: 0.0001, checkColumnNames: false }, res);
          if (!cmp.pass) {
            ok = false;
            fail(`${d} 결과가 다름 (답 "${answer}"): ${JSON.stringify(res.rows[0])} vs ${JSON.stringify(base.rows[0])}`);
          }
        }
      }
      if (ok && base) lines.push(`${card.id.padEnd(32)} ${dialects.join(",")} 일치 ${JSON.stringify(base.rows[0])}`);
      const cardRaw = raw.cards.find((c: { id: string }) => c.id === card.id);
      outCards.push(base ? { ...cardRaw, result: { columns: base.columns, rows: base.rows } } : cardRaw);
    }
    writeFileSync(file, JSON.stringify({ ...raw, cards: outCards }, null, 2) + "\n");
  }
  duck.close();
  await pg.close();
  console.log(lines.join("\n"));
  console.log(failures ? `\n실패/경고 ${failures}건` : `\n모두 통과 (${seen.size}장)`);
  process.exit(failures ? 1 : 0);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
