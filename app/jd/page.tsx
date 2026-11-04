import { readFileSync } from "node:fs";
import path from "node:path";
import { JdAnalyzer } from "@/components/JdAnalyzer";
import { listProblems, listSchemas } from "@/lib/content/loader";
import type { Competency, ProblemSummary } from "@/lib/jd/match";

export default async function JdPage() {
  const { items } = JSON.parse(readFileSync(path.join(process.cwd(), "content", "jd", "competencies.json"), "utf-8")) as { items: Competency[] };
  const [all, schemas] = await Promise.all([listProblems(), listSchemas()]);
  // 잠긴 세트 문제는 공개 화면에 제목도 내보내지 않는다
  const locked = new Set(schemas.filter((s) => s.locked).map((s) => s.id));
  const problems: ProblemSummary[] = all.filter((p) => !locked.has(p.schema)).map(({ id, title, difficulty, format, sourceType, tags }) => ({ id, title, difficulty, format, sourceType, tags }));
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">채용 공고로 문제 고르기</h1>
      <p className="mt-2 text-[14.5px] leading-relaxed text-fg/80">공고 본문을 붙여넣으면 요구 역량을 찾아 맞는 문제를 추천합니다. 본문은 브라우저에만 저장됩니다.</p>
      <JdAnalyzer competencies={items} problems={problems} />
    </div>
  );
}
