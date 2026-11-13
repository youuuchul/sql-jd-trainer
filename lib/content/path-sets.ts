import "server-only";
import type { PathProblem, PathSet } from "@/lib/path";
import { listProblemMeta, listSchemaMeta, listSets } from "./loader";
import { SetCategorySchema } from "./types";

/**
 * 진행 경로용 세트 요약. 분류 순서(SetCategorySchema.options) → set.order 로 정렬한다.
 * 잠긴 스키마의 세트는 문제 제목·도메인을 내보내지 않는다(problems 빈 배열, domain 빈 문자열, problemCount 만).
 *
 * Args:
 *   unlocked: 요청이 잠금 해제 쿠키를 가졌을 때 true. 잠긴 세트도 문제를 싣는다.
 *
 * Returns:
 *   화면에 필요한 필드만 담은 세트 목록.
 */
export const listPathSets = async ({ unlocked = false }: { unlocked?: boolean } = {}): Promise<PathSet[]> => {
  const [sets, schemas, problems] = await Promise.all([listSets(), listSchemaMeta(), listProblemMeta()]);
  const schemaById = new Map(schemas.map((s) => [s.id, s]));
  const problemById = new Map(problems.map((p) => [p.id, p]));
  const rank = (c: string) => SetCategorySchema.options.indexOf(c as (typeof SetCategorySchema.options)[number]);
  return [...sets]
    .sort((a, b) => rank(a.category) - rank(b.category) || a.order - b.order)
    .map((s) => {
      const schema = schemaById.get(s.schema);
      const hidden = Boolean(schema?.locked) && !unlocked;
      const items: PathProblem[] = hidden
        ? []
        : s.problems.flatMap((id) => {
            const p = problemById.get(id);
            return p ? [{ id: p.id, title: p.title, format: p.format, difficulty: p.difficulty, sourceType: p.sourceType, timeLimitMin: p.timeLimitMin, tags: p.tags }] : [];
          });
      return {
        id: s.id,
        title: s.title,
        description: s.description,
        category: s.category,
        order: s.order,
        mode: s.mode,
        domain: hidden ? "" : (schema?.domain ?? ""),
        locked: hidden,
        problemCount: s.problems.length,
        problems: items,
      };
    });
};
