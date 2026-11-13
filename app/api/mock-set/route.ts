import type { NextRequest } from "next/server";
import { getProblem, getSchema, listSchemaMeta } from "@/lib/content/loader";
import type { Problem } from "@/lib/content/types";

const MAX_IDS = 50;

/** 공고 추천 모의 시험용. 요청한 순서대로 문제와 그 스키마를 돌려준다. 잠긴 스키마의 문제는 잠금 해제 여부와 상관없이 뺀다 */
export async function GET(request: NextRequest) {
  const ids = [...new Set((request.nextUrl.searchParams.get("ids") ?? "").split(",").filter(Boolean))].slice(0, MAX_IDS);
  const [found, schemas] = await Promise.all([Promise.all(ids.map(getProblem)), listSchemaMeta()]);
  const open = new Set(schemas.filter((s) => !s.locked).map((s) => s.id));
  const problems = found.filter((p): p is Problem => p !== undefined && open.has(p.schema));
  const used = await Promise.all([...new Set(problems.map((p) => p.schema))].map(getSchema));
  return Response.json({ problems, schemas: used });
}
