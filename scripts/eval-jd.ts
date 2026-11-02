/**
 * JD 역량 매핑 평가. content/eval/jd-samples.json 의 샘플마다 expected 역량이 모두 잡히고
 * unexpected 역량이 하나도 잡히지 않으며 expected 역량마다 추천 문제가 1개 이상이면 통과. 하나라도 실패하면 종료 코드 1.
 * 사전 점검으로 모든 역량의 problemTags 가 실제 문제 태그와 겹치는지도 확인한다.
 * 실행: npx tsx scripts/eval-jd.ts
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { ProblemSchema, type Problem } from "../lib/content/types";
import { analyzeJd, recommendProblems, type Competency } from "../lib/jd/match";

const ROOT = path.join(process.cwd(), "content");

interface Sample {
  id: string;
  note?: string;
  text: string;
  expected: string[];
  unexpected: string[];
}

const listJson = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? listJson(path.join(dir, e.name)) : e.name.endsWith(".json") ? [path.join(dir, e.name)] : [])).sort();

const main = () => {
  const problems: Problem[] = listJson(path.join(ROOT, "problems")).map((f) => ProblemSchema.parse(JSON.parse(readFileSync(f, "utf-8"))));
  const { items: competencies } = JSON.parse(readFileSync(path.join(ROOT, "jd", "competencies.json"), "utf-8")) as { items: Competency[] };
  const { items: samples } = JSON.parse(readFileSync(path.join(ROOT, "eval", "jd-samples.json"), "utf-8")) as { items: Sample[] };

  const allTags = new Set(problems.flatMap((p) => p.tags));
  const ids = new Set(competencies.map((c) => c.id));
  for (const c of competencies) {
    const dead = c.problemTags.filter((t) => !allTags.has(t));
    if (dead.length) throw new Error(`${c.id}: 문제에 없는 태그 ${dead.join(", ")}`);
    const covered = problems.filter((p) => p.tags.some((t) => c.problemTags.includes(t))).length;
    if (!covered) throw new Error(`${c.id}: 추천 가능한 문제가 없음`);
  }
  for (const s of samples) {
    const unknown = [...s.expected, ...s.unexpected].filter((id) => !ids.has(id));
    if (unknown.length) throw new Error(`${s.id}: 사전에 없는 역량 ${unknown.join(", ")}`);
  }

  let pass = 0;
  const lines: string[] = [];
  for (const s of samples) {
    const matches = analyzeJd(s.text, competencies);
    const found = new Set(matches.map((m) => m.competency.id));
    const missing = s.expected.filter((id) => !found.has(id));
    const wrong = s.unexpected.filter((id) => found.has(id));
    const recs = recommendProblems(matches, problems);
    const labelOf = (id: string) => competencies.find((c) => c.id === id)!.label;
    const uncovered = s.expected.filter((id) => !recs.some((r) => r.reasons.includes(labelOf(id))));
    const ok = !missing.length && !wrong.length && !uncovered.length;
    if (ok) pass++;
    const detail = [missing.length ? `누락 ${missing.join(",")}` : "", wrong.length ? `오검출 ${wrong.join(",")}` : "", uncovered.length ? `추천 없음 ${uncovered.join(",")}` : ""].filter(Boolean).join(" ");
    lines.push(`${ok ? "통과" : "실패"} | ${s.id.padEnd(18)} | 검출 ${[...found].join(",") || "(없음)"} | 추천 ${recs.length}건 ${detail}`);
  }
  console.log(lines.join("\n"));
  console.log(`\n통과 ${pass}/${samples.length}`);
  process.exit(pass === samples.length ? 0 : 1);
};

main();
