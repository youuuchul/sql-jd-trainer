import { useMemo } from "react";
import type { Difficulty, ProblemFormat, SetCategory, SourceType } from "@/lib/content/types";
import { useProgressStore, type ProblemProgress } from "@/lib/progress";

/** 완료(통과)·현재(분류 안 첫 미통과)·할 일(열림)·잠김(비밀번호 아카이브) */
export type NodeState = "done" | "cur" | "todo" | "lock";

export interface PathProblem {
  id: string;
  title: string;
  format: ProblemFormat;
  difficulty: Difficulty;
  sourceType: SourceType;
  /** 권장 시간(분). 없으면 null */
  timeLimitMin: number | null;
  tags: string[];
}

export interface PathSet {
  id: string;
  title: string;
  description: string;
  category: SetCategory;
  order: number;
  mode: "practice" | "mock";
  /** 스키마 도메인(예: 마케팅·그로스) */
  domain: string;
  /** 잠겨 있으면 problems 는 비고 problemCount 만 있다 */
  locked: boolean;
  problemCount: number;
  problems: PathProblem[];
}

export interface PathNode {
  problem: PathProblem;
  set: PathSet;
  /** 세트 안 0부터 */
  index: number;
  state: NodeState;
  progress: ProblemProgress | undefined;
}

export interface SetPath {
  set: PathSet;
  nodes: PathNode[];
  passed: number;
  total: number;
  /** 세트 단위 상태: 모두 통과 done, 분류의 현재 문제를 가지면 cur, 잠김 lock, 나머지 todo */
  state: NodeState;
}

export interface CategoryPath {
  category: SetCategory;
  sets: SetPath[];
  passed: number;
  total: number;
  /** 분류 안 모든 세트가 잠김 */
  locked: boolean;
  /** 분류 안 첫 미통과 문제. 모두 통과했거나 잠겼으면 null */
  current: PathNode | null;
}

export interface PathView {
  categories: CategoryPath[];
  /** 잠기지 않은 분류 순서상 첫 미통과 문제 */
  next: PathNode | null;
  /** 시도했지만 미통과. 저장값에 시도 시각이 없어 경로 순서로 둔다 */
  inProgress: PathNode[];
}

/**
 * 세트 목록과 진행 저장값으로 진행 경로를 계산한다. 순서는 권장만이라 잠긴 세트 밖의 노드는 모두 열려 있다.
 *
 * Args:
 *   sets: listPathSets() 결과(분류 → order 순으로 정렬돼 있어야 한다).
 *   progress: lib/progress 저장값(문제 id → 진행).
 *
 * Returns:
 *   분류별·세트별 진행과 노드 상태, 지금 권장 문제, 풀던 문제.
 */
export const computePath = (sets: PathSet[], progress: Record<string, ProblemProgress>): PathView => {
  const order: SetCategory[] = [];
  const bySet = new Map<SetCategory, PathSet[]>();
  for (const s of sets) {
    if (!bySet.has(s.category)) {
      bySet.set(s.category, []);
      order.push(s.category);
    }
    bySet.get(s.category)!.push(s);
  }
  const inProgress: PathNode[] = [];
  const seen = new Set<string>();
  const categories = order.map((category): CategoryPath => {
    let current: PathNode | null = null;
    const setPaths = bySet.get(category)!.map((set): SetPath => {
      const nodes = set.problems.map((problem, index): PathNode => {
        const pr = progress[problem.id];
        const node: PathNode = { problem, set, index, state: pr?.passed ? "done" : "todo", progress: pr };
        if (!pr?.passed && !current) {
          node.state = "cur";
          current = node;
        }
        if (pr && !pr.passed && pr.attempts > 0 && !seen.has(problem.id)) {
          seen.add(problem.id);
          inProgress.push(node);
        }
        return node;
      });
      const passed = nodes.filter((n) => n.state === "done").length;
      const total = set.locked ? set.problemCount : nodes.length;
      const state: NodeState = set.locked ? "lock" : total > 0 && passed === total ? "done" : nodes.some((n) => n.state === "cur") ? "cur" : "todo";
      return { set, nodes, passed, total, state };
    });
    return {
      category,
      sets: setPaths,
      passed: setPaths.reduce((a, s) => a + s.passed, 0),
      total: setPaths.reduce((a, s) => a + s.total, 0),
      locked: setPaths.every((s) => s.set.locked),
      current,
    };
  });
  const next = categories.find((c) => !c.locked && c.current)?.current ?? null;
  return { categories, next, inProgress };
};

/** computePath 를 진행 저장값에 구독해 돌린다. 서버 렌더·하이드레이션 중에는 저장값이 비어 있다 */
export const usePath = (sets: PathSet[]): PathView => {
  const progress = useProgressStore();
  return useMemo(() => computePath(sets, progress), [sets, progress]);
};
