/**
 * 문제의 정답 쿼리를 실제 엔진에서 돌려 기대 결과를 생성하고, 세 방언의 결과가 같은지 확인한다.
 * 실행: npx tsx scripts/build-expected.ts [문제ID 접두사 ...]
 * MYSQL_URL이 있으면 MySQL 정답도 검증한다. (예: MYSQL_URL=mysql://root:sjt@127.0.0.1:3307/)
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ProblemSchema, SchemaDefSchema, type Problem, type SchemaDef } from "../lib/content/types";
import { compareResult, multisetExtraIndexes, resultHash } from "../lib/grading/compare";
import type { QueryResult } from "../lib/engine/types";
import { createDuckdbNode } from "./duckdb-node";
import { createMysqlNode } from "./mysql-node";
import { createPgliteNode } from "./pglite-node";

const ROOT = path.join(process.cwd(), "content");
const filters = process.argv.slice(2);

const listJson = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? listJson(path.join(dir, e.name)) : e.name.endsWith(".json") ? [path.join(dir, e.name)] : [])).sort();

const main = async () => {
  const schemas = new Map<string, SchemaDef>();
  for (const f of listJson(path.join(ROOT, "schemas"))) {
    const s = SchemaDefSchema.parse(JSON.parse(readFileSync(f, "utf-8")));
    schemas.set(s.id, s);
  }
  const pg = await createPgliteNode();
  const duck = await createDuckdbNode();
  const mysql = process.env.MYSQL_URL ? createMysqlNode() : null;
  const summary: string[] = [];
  let failures = 0;

  for (const file of listJson(path.join(ROOT, "problems"))) {
    if (filters.length && !filters.some((f) => path.basename(file).startsWith(f))) continue;
    const raw = JSON.parse(readFileSync(file, "utf-8"));
    const problem: Problem = ProblemSchema.parse(raw);
    const schema = schemas.get(problem.schema);
    if (!schema) throw new Error(`${problem.id}: unknown schema`);
    const line: string[] = [problem.id.padEnd(34)];
    if (problem.format === "mcq") {
      summary.push(line.join(" ") + " mcq (실행 없음)");
      continue;
    }
    if (!problem.solutions?.postgres) throw new Error(`${problem.id}: solutions.postgres 가 필요합니다`);
    await pg.load(schema);
    duck.load(schema);

    const run = async (dialect: "postgres" | "bigquery" | "mysql", sql: string): Promise<QueryResult | Error> => {
      try {
        if (dialect === "postgres") return await pg.run(sql);
        if (dialect === "bigquery") return duck.run(sql);
        return await mysql!.run(schema, sql);
      } catch (e) {
        return e instanceof Error ? e : new Error(String(e));
      }
    };

    const pgRes = await run("postgres", problem.solutions.postgres);
    if (pgRes instanceof Error) {
      failures++;
      summary.push(`${line.join(" ")} PG 실패: ${pgRes.message.split("\n")[0]}`);
      continue;
    }
    const prev = raw.expected ?? {};
    const expected = {
      columns: pgRes.columns,
      rows: pgRes.rows,
      ordered: prev.ordered ?? false,
      tolerance: prev.tolerance ?? 0.0001,
      checkColumnNames: prev.checkColumnNames ?? false,
    };
    line.push(`PG ${pgRes.rows.length}행`);
    if (pgRes.rows.length === 0) {
      failures++;
      line.push("경고: 결과 0행");
    }

    for (const dialect of ["bigquery", "mysql"] as const) {
      const sql = problem.solutions[dialect];
      if (!sql) {
        line.push(`${dialect} 없음`);
        failures++;
        continue;
      }
      if (dialect === "mysql" && !mysql) {
        line.push("MySQL 건너뜀");
        continue;
      }
      const res = await run(dialect, sql);
      if (res instanceof Error) {
        failures++;
        line.push(`${dialect} 실패: ${res.message.split("\n")[0].slice(0, 120)}`);
        continue;
      }
      const cmp = compareResult(expected, res);
      if (cmp.pass) line.push(`${dialect} 일치`);
      else {
        failures++;
        line.push(`${dialect} 불일치: ${cmp.mismatches.map((m) => m.message).join(" / ")} 누락예=${JSON.stringify(cmp.missing[0])} 초과예=${JSON.stringify(cmp.extra[0])}`);
      }
    }

    const correctHash = resultHash(pgRes);
    const wrongPatterns = [];
    for (const wp of problem.wrongPatterns) {
      if (!wp.sql?.postgres) {
        wrongPatterns.push(wp);
        continue;
      }
      const res = await run("postgres", wp.sql.postgres);
      if (res instanceof Error) {
        failures++;
        line.push(`오답패턴 "${wp.label}" 실행 실패: ${res.message.split("\n")[0].slice(0, 80)}`);
        wrongPatterns.push(wp);
        continue;
      }
      const h = resultHash(res);
      if (h === correctHash) {
        failures++;
        line.push(`오답패턴 "${wp.label}" 이 정답과 같은 결과`);
      }
      wrongPatterns.push({ ...wp, resultHash: h });
    }

    let input = raw.input;
    if (problem.input) {
      const res = await run("postgres", problem.input.sql.postgres ?? "");
      if (res instanceof Error) {
        failures++;
        line.push(`입력 표 실행 실패: ${res.message.split("\n")[0].slice(0, 80)}`);
      } else {
        input = { ...raw.input, columns: res.columns, rows: res.rows };
        line.push(`입력 ${res.rows.length}행`);
        if (res.rows.length === 0 || res.rows.length > 30) {
          failures++;
          line.push("경고: 입력 표는 1~30행이어야 합니다");
        }
      }
    }

    let spot = raw.spot;
    if (problem.spot) {
      const res = await run("postgres", problem.spot.sql.postgres ?? "");
      if (res instanceof Error) {
        failures++;
        line.push(`spot 쿼리 실행 실패: ${res.message.split("\n")[0].slice(0, 80)}`);
      } else {
        const cmp = compareResult({ ...expected, ordered: false }, res);
        const extraKeys = new Set(multisetExtraIndexes(expected.rows, res.rows, expected.tolerance));
        const anomalyRows = res.rows.map((_, i) => i).filter((i) => extraKeys.has(i));
        spot = { ...raw.spot, columns: res.columns, rows: res.rows, anomalyRows };
        line.push(`spot ${res.rows.length}행 이상 ${anomalyRows.length}행`);
        if (cmp.pass || anomalyRows.length === 0) {
          failures++;
          line.push("경고: spot 쿼리 결과에 정답과 다른 행이 없습니다");
        }
        if (res.rows.length > 40) {
          failures++;
          line.push("경고: spot 결과는 40행 이하여야 합니다");
        }
        for (const dialect of ["bigquery", "mysql"] as const) {
          const sql = problem.spot.sql[dialect];
          if (!sql) continue;
          if (dialect === "mysql" && !mysql) continue;
          const other = await run(dialect, sql);
          if (other instanceof Error) {
            failures++;
            line.push(`spot ${dialect} 실패: ${other.message.split("\n")[0].slice(0, 80)}`);
            continue;
          }
          const same = compareResult({ columns: res.columns, rows: res.rows, ordered: true, tolerance: expected.tolerance, checkColumnNames: false }, other);
          if (!same.pass) {
            failures++;
            line.push(`spot ${dialect} 결과가 PG와 다름(행 순서 포함): ${same.mismatches.map((m) => m.message).join(" / ")}`);
          }
        }
      }
    }

    let review = raw.review;
    if (problem.review) {
      const results: Record<string, unknown> = { ...(raw.review.results ?? {}) };
      type LineRef = { match: string[]; dialects?: string[]; lines: Record<string, number[]> };
      const defects: (LineRef & { title: string })[] = raw.review.defects.map((d: LineRef) => ({ ...d, lines: {} }));
      const decoys: (LineRef & { explanation: string })[] = (raw.review.decoys ?? []).map((d: LineRef) => ({ ...d, lines: {} }));
      for (const dialect of ["postgres", "bigquery", "mysql"] as const) {
        const sql = problem.review.sql[dialect];
        if (!sql) {
          failures++;
          line.push(`review ${dialect} 없음`);
          continue;
        }
        const applies = (ref: LineRef) => !ref.dialects || ref.dialects.includes(dialect);
        const textLines = sql.split("\n");
        const owner = new Map<number, string>();
        const resolve = (ref: LineRef, label: string) => {
          if (!applies(ref)) return;
          const found = textLines.flatMap((t, i) => (ref.match.some((m) => t.toLowerCase().includes(m.toLowerCase())) ? [i + 1] : []));
          if (!found.length) {
            failures++;
            line.push(`review ${dialect} "${label}" 줄을 찾지 못함`);
          }
          for (const n of found) {
            if (owner.has(n)) {
              failures++;
              line.push(`review ${dialect} ${n}번째 줄이 "${owner.get(n)}" 와 "${label}" 에 겹침`);
            }
            owner.set(n, label);
          }
          ref.lines[dialect] = found;
        };
        for (const d of defects) resolve(d, d.title);
        for (const d of decoys) resolve(d, `오탐 ${d.explanation.slice(0, 16)}`);
        if (!defects.some(applies)) {
          failures++;
          line.push(`review ${dialect} 에 해당하는 결함이 없음`);
        }
        if (!/\border\s+by\b/i.test(sql)) {
          failures++;
          line.push(`review ${dialect} ORDER BY 가 없음`);
        }
        if (dialect === "mysql" && !mysql) {
          line.push("review MySQL 건너뜀");
          continue;
        }
        const res = await run(dialect, sql);
        if (res instanceof Error) {
          failures++;
          line.push(`review ${dialect} 실패: ${res.message.split("\n")[0].slice(0, 80)}`);
          continue;
        }
        const anomalyRows = multisetExtraIndexes(expected.rows, res.rows, expected.tolerance);
        results[dialect] = { columns: res.columns, rows: res.rows, anomalyRows };
        line.push(`review ${dialect} ${res.rows.length}행 이상 ${anomalyRows.length}행`);
        if (compareResult({ ...expected, ordered: false }, res).pass) {
          failures++;
          line.push(`경고: review ${dialect} 결과가 정답과 같습니다`);
        }
        if (res.rows.length > 40) {
          failures++;
          line.push(`경고: review ${dialect} 결과는 40행 이하여야 합니다`);
        }
      }
      review = { ...raw.review, defects, decoys, results };
    }

    const out = { ...raw, expected, wrongPatterns, ...(input ? { input } : {}), ...(spot ? { spot } : {}), ...(review ? { review } : {}) };
    writeFileSync(file, JSON.stringify(out, null, 2) + "\n");
    summary.push(line.join(" | "));
  }
  duck.close();
  await pg.close();
  console.log(summary.join("\n"));
  console.log(failures ? `\n실패/경고 ${failures}건` : "\n모두 통과");
  process.exit(failures ? 1 : 0);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
