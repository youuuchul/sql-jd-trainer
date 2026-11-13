import "server-only";
import type { SkillView } from "@/lib/skills";
import { listDecks, listProblemMeta, listSchemaMeta, listSkills } from "./loader";
import { isShown } from "@/lib/daily/srs";
import type { Difficulty } from "./types";

const DIFF_RANK: Record<Difficulty, number> = { basic: 0, intermediate: 1, advanced: 2 };

/**
 * 유형 탭용 요약. 잠긴 스키마의 문제는 넣지 않는다. 문제는 쉬운 것부터, 같은 난이도에서는 이 유형이 대표 유형인 문제부터 정렬한다.
 *
 * Returns:
 *   선반(패턴 → 함수 → 기초 문법)과 order 순의 유형 목록.
 */
export const listSkillViews = async (): Promise<SkillView[]> => {
  const [skills, problems, schemas, decks] = await Promise.all([listSkills(), listProblemMeta(), listSchemaMeta(), listDecks()]);
  const locked = new Set(schemas.filter((s) => s.locked).map((s) => s.id));
  const open = problems.filter((p) => !locked.has(p.schema));
  const cards = decks.flatMap((d) => d.cards).filter(isShown);
  return skills.map((s) => ({
    id: s.id,
    shelf: s.shelf,
    title: s.title,
    summary: s.summary,
    cardCount: cards.filter((c) => c.syntax.some((id) => s.syntax.includes(id))).length,
    problems: open
      .filter((p) => p.skills.includes(s.id))
      .sort((a, b) => DIFF_RANK[a.difficulty] - DIFF_RANK[b.difficulty] || Number(b.skills[0] === s.id) - Number(a.skills[0] === s.id) || a.id.localeCompare(b.id))
      .map((p) => ({ id: p.id, title: p.title, difficulty: p.difficulty, format: p.format, timeLimitMin: p.timeLimitMin, primary: p.skills[0] === s.id, blanks: p.blanks })),
  }));
};
