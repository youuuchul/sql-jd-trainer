/**
 * 오답 진단 적중률 평가. content/eval/wrong-queries.json 의 오답 쿼리를 PGlite로 실행해
 * 채점·진단하고, 기대 라벨이 진단 라벨에 포함되는 비율을 출력한다. 80% 미만이면 실패.
 * 실행: npx tsx scripts/eval-diagnose.ts
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { ProblemSchema, SchemaDefSchema, type Problem, type SchemaDef } from "../lib/content/types";
import { compareResult } from "../lib/grading/compare";
import { diagnose } from "../lib/grading/diagnose";
import { createPgliteNode } from "./pglite-node";

const ROOT = path.join(process.cwd(), "content");
const TARGET = 0.8;

interface EvalItem {
  problem: string;
  label: string;
  note?: string;
  sql: string;
}

const listJson = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? listJson(path.join(dir, e.name)) : e.name.endsWith(".json") ? [path.join(dir, e.name)] : [])).sort();

const main = async () => {
  const schemas = new Map<string, SchemaDef>();
  for (const f of listJson(path.join(ROOT, "schemas"))) {
    const s = SchemaDefSchema.parse(JSON.parse(readFileSync(f, "utf-8")));
    schemas.set(s.id, s);
  }
  const problems = new Map<string, Problem>();
  for (const f of listJson(path.join(ROOT, "problems"))) {
    const p = ProblemSchema.parse(JSON.parse(readFileSync(f, "utf-8")));
    problems.set(p.id, p);
  }
  const { items } = JSON.parse(readFileSync(path.join(ROOT, "eval", "wrong-queries.json"), "utf-8")) as { items: EvalItem[] };

  const pg = await createPgliteNode();
  let hits = 0;
  const lines: string[] = [];
  for (const item of items) {
    const problem = problems.get(item.problem);
    if (!problem?.expected) throw new Error(`${item.problem}: 문제 또는 expected 없음`);
    const schema = schemas.get(problem.schema)!;
    await pg.load(schema);
    let labels: string[];
    let status: string;
    try {
      const result = await pg.run(item.sql);
      const cmp = compareResult(problem.expected, result);
      if (cmp.pass) {
        labels = [];
        status = "정답 처리됨(오답이 아님)";
      } else {
        labels = diagnose(problem, result, cmp).map((d) => `${d.label}${d.source === "pattern" ? "(패턴)" : "(규칙)"}`);
        status = labels.join(", ") || "진단 없음";
      }
    } catch (e) {
      labels = [];
      status = `실행 오류: ${(e as Error).message.split("\n")[0].slice(0, 80)}`;
    }
    const hit = labels.some((l) => l.startsWith(item.label));
    if (hit) hits++;
    lines.push(`${hit ? "적중" : "미적중"} | ${item.problem.padEnd(40)} | 기대 ${item.label} | 진단 ${status}`);
  }
  await pg.close();
  console.log(lines.join("\n"));
  const rate = hits / items.length;
  console.log(`\n적중 ${hits}/${items.length} (${Math.round(rate * 100)}%), 목표 ${TARGET * 100}%`);
  process.exit(rate >= TARGET ? 0 : 1);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
