import type { NextRequest } from "next/server";
import { listProblems, listSchemas } from "@/lib/content/loader";
import type { Problem } from "@/lib/content/types";

const MAX_IDS = 50;

/** 공고 추천 모의 시험용. 요청한 순서대로 문제와 그 스키마를 돌려준다. 잠긴 스키마의 문제는 잠금 해제 여부와 상관없이 뺀다 */
export async function GET(request: NextRequest) {
  const ids = [...new Set((request.nextUrl.searchParams.get("ids") ?? "").split(",").filter(Boolean))].slice(0, MAX_IDS);
  const [all, schemas] = await Promise.all([listProblems(), listSchemas()]);
  const open = new Map(schemas.filter((s) => !s.locked).map((s) => [s.id, s]));
  const problems = ids.map((id) => all.find((p) => p.id === id)).filter((p): p is Problem => p !== undefined && open.has(p.schema));
  const used = [...new Set(problems.map((p) => p.schema))].map((id) => open.get(id)!);
  return Response.json({ problems, schemas: used });
}
