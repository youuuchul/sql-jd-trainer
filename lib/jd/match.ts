import type { Difficulty, Problem } from "@/lib/content/types";

export interface Competency {
  id: string;
  label: string;
  /** JD 코퍼스에서의 언급 빈도 또는 포함 근거. 화면 표시용 */
  frequency: string;
  keywords: string[];
  problemTags: string[];
}

export interface CompetencyMatch {
  competency: Competency;
  /** JD 본문에서 실제로 찾은 키워드 (사전 표기 기준) */
  matched: string[];
}

/** 추천 목록에 필요한 최소 문제 정보. 서버 컴포넌트가 클라이언트로 넘길 때 쓴다. */
export type ProblemSummary = Pick<Problem, "id" | "title" | "difficulty" | "format" | "sourceType" | "tags">;

export interface Recommendation {
  problem: ProblemSummary;
  /** 추천 근거가 된 역량 라벨 */
  reasons: string[];
  score: number;
}

const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, "");

/** JD 본문에서 역량 키워드를 찾아 매칭 수가 많은 순으로 돌려준다. 공백·대소문자는 무시한다. */
export const analyzeJd = (text: string, competencies: Competency[]): CompetencyMatch[] => {
  const body = normalize(text);
  if (!body) return [];
  const matches: CompetencyMatch[] = [];
  for (const competency of competencies) {
    const matched = competency.keywords.filter((k) => body.includes(normalize(k)));
    if (matched.length) matches.push({ competency, matched });
  }
  return matches.sort((a, b) => b.matched.length - a.matched.length);
};

const DIFF_ORDER: Record<Difficulty, number> = { basic: 0, intermediate: 1, advanced: 2 };

/**
 * 매칭된 역량의 problemTags와 문제 tags의 교집합으로 점수를 매긴다.
 * 역량당 1점이며, 점수가 같으면 쉬운 문제를 앞에 둔다.
 * 상위 limit개에 빠진 역량이 있으면 그 역량의 최상위 문제를 뒤에 붙여 역량마다 문제가 하나는 있게 한다.
 */
export const recommendProblems = (matches: CompetencyMatch[], problems: ProblemSummary[], limit = 12): Recommendation[] => {
  const ranked: Recommendation[] = [];
  for (const problem of problems) {
    const tags = new Set(problem.tags);
    const reasons = matches.filter((m) => m.competency.problemTags.some((t) => tags.has(t))).map((m) => m.competency.label);
    if (reasons.length) ranked.push({ problem, reasons, score: reasons.length });
  }
  ranked.sort((a, b) => b.score - a.score || DIFF_ORDER[a.problem.difficulty] - DIFF_ORDER[b.problem.difficulty] || a.problem.id.localeCompare(b.problem.id));
  const out = ranked.slice(0, limit);
  for (const { competency } of matches) {
    if (out.some((r) => r.reasons.includes(competency.label))) continue;
    const best = ranked.find((r) => r.reasons.includes(competency.label));
    if (best) out.push(best);
  }
  return out;
};
