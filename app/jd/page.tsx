import { readFileSync } from "node:fs";
import path from "node:path";
import { JdAnalyzer } from "@/components/JdAnalyzer";
import { listProblemMeta, listSchemaMeta } from "@/lib/content/loader";
import type { Competency, ProblemSummary } from "@/lib/jd/match";

export default async function JdPage() {
  const { items } = JSON.parse(readFileSync(path.join(process.cwd(), "content", "jd", "competencies.json"), "utf-8")) as { items: Competency[] };
  const [all, schemas] = await Promise.all([listProblemMeta(), listSchemaMeta()]);
  // 잠긴 세트 문제는 공개 화면에 제목도 내보내지 않는다
  const locked = new Set(schemas.filter((s) => s.locked).map((s) => s.id));
  const open = all.filter((p) => !locked.has(p.schema));
  const problems: ProblemSummary[] = open.map(({ id, title, difficulty, format, sourceType, tags }) => ({ id, title, difficulty, format, sourceType, tags }));
  const minutes = Object.fromEntries(open.map((p) => [p.id, p.timeLimitMin]));
  return <JdAnalyzer competencies={items} problems={problems} minutes={minutes} />;
}
