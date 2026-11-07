import type { Problem, SchemaDef } from "../content/types";
import { prepareScript } from "../engine/script";
import { columnOwners, replaceHead, splitHead } from "./script";

/** 파이프라인 문제 게시 전 검사: 빌드 값, 두 방언 정답(변형 포함)의 허용 문장·변수 이름(컬럼과 겹침), 확인 조회가 읽는 테이블. 문제 목록을 돌려준다 */
export const checkScriptProblem = (p: Problem, schema: SchemaDef): string[] => {
  const script = p.script!;
  const out: string[] = [];
  if (p.format !== "write" && p.format !== "fix") out.push("파이프라인 문제는 write 또는 fix 형식이어야 합니다");
  if (!script.results.length) out.push("script.results 가 없습니다. build-expected 를 먼저 실행하세요");
  const columns = columnOwners(schema);
  for (const d of ["postgres", "bigquery"] as const) {
    const sol = p.solutions?.[d];
    if (!sol) {
      out.push(`solutions.${d} 가 필요합니다`);
      continue;
    }
    if (script.variants.length && !splitHead(sol)) out.push(`solutions.${d} 에 머리 구획 표식이 없습니다`);
    const sqls = [{ label: `solutions.${d}`, sql: sol }];
    for (const v of script.variants) {
      const h = v.head[d];
      if (!h) out.push(`변형 "${v.label}" 의 head.${d} 가 없습니다`);
      if (!v.results.length) out.push(`변형 "${v.label}" 의 results 가 없습니다. build-expected 를 먼저 실행하세요`);
      const sql = h ? replaceHead(sol, h) : null;
      if (sql) sqls.push({ label: `변형 "${v.label}" ${d}`, sql });
    }
    for (const { label, sql } of sqls) {
      try {
        prepareScript(d, sql, columns);
      } catch (e) {
        out.push(`${label}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }
  const seeds = new Set(schema.tables.map((t) => t.name.toLowerCase()));
  for (const probe of script.probes) {
    const names = [...probe.matchAll(/\b(?:FROM|JOIN)\s+([\w."`]+)/gi)].map((m) => m[1].replace(/[`"]/g, "").split(".").pop()!.toLowerCase());
    for (const n of names) if (!(n in script.tables) && !seeds.has(n)) out.push(`확인 조회가 읽는 ${n} 테이블을 정답 스크립트가 만들지 않습니다`);
    if (!names.some((n) => n in script.tables)) out.push(`확인 조회 "${probe.slice(0, 40)}" 는 정답 스크립트가 만든 테이블을 읽어야 합니다`);
  }
  return out;
};
