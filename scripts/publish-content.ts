/**
 * 로컬 content/(문제·세트·스키마·카드·카드 문법·유형)를 검증해 운영 DB(content_item)에 그대로 맞춘다. 로컬에 없는 행은 지운다.
 * 콘텐츠는 저장소에 두지 않는다. 작성·검증은 로컬 파일로 하고 이 스크립트로 게시한다.
 * 실행: npx tsx scripts/publish-content.ts                  # DB 반영
 *       npx tsx scripts/publish-content.ts --dry-run        # 검증만
 *       npx tsx scripts/publish-content.ts --revalidate https://sql-jd-trainer.vercel.app
 * DATABASE_URL, CRON_SECRET 은 .env.local 에서 읽는다.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { neon } from "@neondatabase/serverless";
import { CardDeckSchema, DIALECTS, ProblemSchema, ProblemSetSchema, SchemaDefSchema, SkillSchema, SyntaxRefSchema, type SchemaDef } from "../lib/content/types";
import { checkScriptProblem } from "../lib/grading/script-check";

loadEnvConfig(process.cwd(), true);

const ROOT = path.join(process.cwd(), "content");
const listJson = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? listJson(path.join(dir, e.name)) : e.name.endsWith(".json") ? [path.join(dir, e.name)] : [])).sort();
const readJson = (file: string): unknown => JSON.parse(readFileSync(file, "utf-8"));

type Row = { kind: "schema" | "problem" | "set" | "deck" | "syntax" | "skill"; id: string; body: unknown };

const collect = (): Row[] => {
  const rows: Row[] = [];
  const schemaIds = new Set<string>();
  const schemas = new Map<string, SchemaDef>();
  for (const file of listJson(path.join(ROOT, "schemas"))) {
    const s = SchemaDefSchema.parse(readJson(file));
    schemaIds.add(s.id);
    schemas.set(s.id, s);
    rows.push({ kind: "schema", id: s.id, body: s });
  }
  const problemIds = new Set<string>();
  const usedSkills = new Map<string, string>();
  for (const file of listJson(path.join(ROOT, "problems"))) {
    const p = ProblemSchema.parse(readJson(file));
    if (!schemaIds.has(p.schema)) throw new Error(`${file}: unknown schema ${p.schema}`);
    if (p.format !== "mcq" && !p.expected?.rows.length) throw new Error(`${file}: expected 결과가 없습니다. build-expected 를 먼저 실행하세요.`);
    if (p.script) {
      const problems = checkScriptProblem(p, schemas.get(p.schema)!);
      if (problems.length) throw new Error(`${file}: ${problems.join(" / ")}`);
    }
    if (p.format === "predict" && !p.input?.rows.length) throw new Error(`${file}: predict 문제는 input 표가 필요합니다.`);
    if (p.format === "spot" && !p.spot?.anomalyRows.length) throw new Error(`${file}: spot 문제는 spot.anomalyRows 가 필요합니다.`);
    if (p.format === "review") {
      if (!p.review) throw new Error(`${file}: review 문제는 review 가 필요합니다.`);
      for (const d of DIALECTS) {
        if (!p.review.sql[d]) continue;
        if (!p.review.results[d]) throw new Error(`${file}: review.results.${d} 가 없습니다. MYSQL_URL 을 주고 build-expected 를 실행하세요.`);
        for (const ref of [...p.review.defects, ...p.review.decoys])
          if ((!ref.dialects || ref.dialects.includes(d)) && !ref.lines[d]?.length) throw new Error(`${file}: review 줄(${ref.match[0]})이 ${d} 에서 풀리지 않았습니다.`);
      }
    }
    if (problemIds.has(p.id)) throw new Error(`${file}: 문제 id 중복 ${p.id}`);
    problemIds.add(p.id);
    for (const id of p.skills) usedSkills.set(id, file);
    rows.push({ kind: "problem", id: p.id, body: p });
  }
  for (const file of listJson(path.join(ROOT, "sets"))) {
    const s = ProblemSetSchema.parse(readJson(file));
    for (const id of s.problems) if (!problemIds.has(id)) throw new Error(`${file}: unknown problem ${id}`);
    rows.push({ kind: "set", id: s.id, body: s });
  }
  const syntaxIds = new Set<string>();
  for (const file of listJson(path.join(ROOT, "syntax"))) {
    for (const s of SyntaxRefSchema.array().parse(readJson(file))) {
      if (syntaxIds.has(s.id)) throw new Error(`${file}: 문법 id 중복 ${s.id}`);
      syntaxIds.add(s.id);
      rows.push({ kind: "syntax", id: s.id, body: s });
    }
  }
  const skillIds = new Set<string>();
  for (const file of listJson(path.join(ROOT, "skills"))) {
    for (const s of SkillSchema.array().parse(readJson(file))) {
      if (skillIds.has(s.id)) throw new Error(`${file}: 유형 id 중복 ${s.id}`);
      for (const id of s.syntax) if (!syntaxIds.has(id)) throw new Error(`${file}: 유형 ${s.id} 의 문법 ${id} 가 content/syntax 에 없습니다.`);
      skillIds.add(s.id);
      rows.push({ kind: "skill", id: s.id, body: s });
    }
  }
  for (const [id, file] of usedSkills) if (!skillIds.has(id)) throw new Error(`${file}: unknown skill ${id}`);
  for (const file of listJson(path.join(ROOT, "cards"))) {
    const d = CardDeckSchema.parse(readJson(file));
    for (const c of d.cards) {
      if (!c.result) throw new Error(`${file}: 카드 ${c.id} 의 result 가 없습니다. build-cards 를 먼저 실행하세요.`);
      if (!c.syntax.length) throw new Error(`${file}: 카드 ${c.id} 에 문법(syntax)이 없습니다.`);
      for (const id of c.syntax) if (!syntaxIds.has(id)) throw new Error(`${file}: 카드 ${c.id} 의 문법 ${id} 가 content/syntax 에 없습니다.`);
    }
    rows.push({ kind: "deck", id: d.id, body: d });
  }
  return rows;
};

const main = async () => {
  const args = process.argv.slice(2);
  const rows = collect();
  const count = (k: Row["kind"]) => rows.filter((r) => r.kind === k).length;
  console.log(`검증 통과: 스키마 ${count("schema")}, 문제 ${count("problem")}, 세트 ${count("set")}, 덱 ${count("deck")}, 문법 ${count("syntax")}, 유형 ${count("skill")}`);
  if (args.includes("--dry-run")) return;

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL 이 없습니다");
  const sql = neon(url);
  await sql`CREATE TABLE IF NOT EXISTS content_item (
    kind text NOT NULL,
    id text NOT NULL,
    body jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (kind, id)
  )`;
  let changed = 0;
  for (const r of rows) {
    const res = (await sql`
      INSERT INTO content_item (kind, id, body) VALUES (${r.kind}, ${r.id}, ${JSON.stringify(r.body)}::jsonb)
      ON CONFLICT (kind, id) DO UPDATE SET body = EXCLUDED.body, updated_at = now()
      WHERE content_item.body IS DISTINCT FROM EXCLUDED.body
      RETURNING id`) as unknown[];
    changed += res.length;
  }
  const keep = rows.map((r) => `${r.kind}:${r.id}`);
  const removed = (await sql`DELETE FROM content_item WHERE NOT ((kind || ':' || id) = ANY(${keep}::text[])) RETURNING kind, id`) as { kind: string; id: string }[];
  const [{ n }] = (await sql`SELECT count(*)::int AS n FROM content_item`) as { n: number }[];
  console.log(`DB 반영: 바뀐 행 ${changed}, 지운 행 ${removed.length}${removed.length ? ` (${removed.map((r) => `${r.kind}:${r.id}`).join(", ")})` : ""}, 전체 ${n}`);

  const i = args.indexOf("--revalidate");
  if (i !== -1) {
    const base = args[i + 1];
    const secret = process.env.CRON_SECRET;
    if (!base || !secret) throw new Error("--revalidate 에는 사이트 주소와 CRON_SECRET 이 필요합니다");
    const r = await fetch(new URL("/api/content/revalidate", base), { method: "POST", headers: { authorization: `Bearer ${secret}` } });
    console.log(`캐시 무효화 ${base}: ${r.status}`);
    if (!r.ok) process.exitCode = 1;
  }
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
