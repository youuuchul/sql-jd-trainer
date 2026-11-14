"use client";
import { useSyncExternalStore } from "react";
import type { Difficulty, ProblemFormat, SkillShelf } from "@/lib/content/types";
import type { ProblemProgress } from "@/lib/progress";

/** 유형 화면에 필요한 문제 요약 */
export interface SkillProblem {
  id: string;
  title: string;
  difficulty: Difficulty;
  format: ProblemFormat;
  timeLimitMin: number | null;
  /** 이 유형이 문제의 대표 유형(skills[0])이면 true */
  primary: boolean;
  /** 빈칸 채우기를 할 수 있는 문제 */
  blanks: boolean;
}

export interface SkillView {
  id: string;
  shelf: SkillShelf;
  title: string;
  summary: string;
  /** 이 유형에 이어진 카드 수 */
  cardCount: number;
  problems: SkillProblem[];
}

/** 유형별 복습 상태. box 는 간격 단계, -1 은 복습 때 틀려서 다음 통과 때 처음 간격으로 돌아가는 상태 */
export interface SkillReview {
  box: number;
  /** 다음 복습 시각(ms) */
  due: number;
  lastAt: number;
}

/** 통과할 때마다 늘어나는 복습 간격(일) */
export const SKILL_INTERVAL_DAYS = [1, 3, 7, 14, 30] as const;
const DAY = 86400000;

/**
 * 채점 결과로 유형의 다음 복습 시각을 정한다. 복습 시각 전에 다시 통과해도 간격은 그대로 둔다.
 *
 * Args:
 *   prev: 지금까지의 상태. 처음이면 undefined.
 *   pass: 이번 채점이 통과인지.
 *   now: 현재 시각(ms).
 *
 * Returns:
 *   바뀐 상태. 바뀔 것이 없으면 prev 그대로.
 */
export const scheduleSkill = (prev: SkillReview | undefined, pass: boolean, now: number): SkillReview | undefined => {
  const due = !prev || prev.due <= now;
  if (!pass) return prev && due ? { ...prev, box: -1, lastAt: now } : prev;
  if (!due) return prev;
  const box = Math.min((prev?.box ?? -1) + 1, SKILL_INTERVAL_DAYS.length - 1);
  return { box, due: now + SKILL_INTERVAL_DAYS[box] * DAY, lastAt: now };
};

type Store = Record<string, SkillReview>;
const KEY = "sjt:skills:v1";
const listeners = new Set<() => void>();
let cache: Store | null = null;
const EMPTY: Store = {};

/** 다른 유형에 합쳐져 없어진 유형. 쌓인 복습 상태는 합쳐진 유형에 기록이 없을 때 그리로 옮긴다 */
const MERGED: Record<string, string> = {
  "f-union": "b-set",
  "f-cast": "b-number",
  "f-round": "b-number",
  "f-coalesce": "b-null",
  "f-nullif": "b-null",
  "f-substr": "b-string",
  "f-row-number": "p-top-n",
};

const migrate = (store: Store): Store => {
  let out = store;
  for (const [from, to] of Object.entries(MERGED)) {
    if (!out[from]) continue;
    const { [from]: old, ...rest } = out;
    out = rest[to] ? rest : { ...rest, [to]: old };
  }
  return out;
};

const read = (): Store => {
  if (cache) return cache;
  if (typeof window === "undefined") return EMPTY;
  try {
    const saved = JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as Store;
    cache = migrate(saved);
    if (cache !== saved) window.localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    cache = {};
  }
  return cache;
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const useSkillStore = (): Store => useSyncExternalStore(subscribe, read, () => EMPTY);

/** 문제 채점 결과를 그 문제의 대표 유형 복습 상태에 반영한다 */
export const recordSkillResult = (skillId: string | undefined, pass: boolean, now = Date.now()) => {
  if (!skillId) return;
  const store = read();
  const next = scheduleSkill(store[skillId], pass, now);
  if (!next || next === store[skillId]) return;
  cache = { ...store, [skillId]: next };
  window.localStorage.setItem(KEY, JSON.stringify(cache));
  listeners.forEach((l) => l());
};

export type ProblemState = "fail" | "todo" | "pass";
export const problemState = (pr: ProblemProgress | undefined): ProblemState => (pr?.passed ? "pass" : pr?.attempts ? "fail" : "todo");

const DIFF_RANK: Record<Difficulty, number> = { basic: 0, intermediate: 1, advanced: 2 };
const STATE_RANK: Record<ProblemState, number> = { fail: 0, todo: 1, pass: 2 };

/**
 * 유형 안에서 다음에 풀 문제. 이 유형이 대표 유형인 문제 가운데 틀린 문제, 안 푼 문제(쉬운 것부터), 통과한 지 가장 오래된 문제 순이다.
 *
 * Args:
 *   problems: 유형의 문제 목록.
 *   progress: 문제 진행 저장값.
 *
 * Returns:
 *   문제가 없으면 null.
 */
export const nextInSkill = (problems: SkillProblem[], progress: Record<string, ProblemProgress>): SkillProblem | null => {
  const own = problems.filter((p) => p.primary);
  const ranked = [...(own.length ? own : problems)].sort((a, b) => {
    const sa = problemState(progress[a.id]);
    const sb = problemState(progress[b.id]);
    if (sa !== sb) return STATE_RANK[sa] - STATE_RANK[sb];
    if (sa === "pass") return (progress[a.id]?.passedAt ?? "").localeCompare(progress[b.id]?.passedAt ?? "");
    return DIFF_RANK[a.difficulty] - DIFF_RANK[b.difficulty] || a.id.localeCompare(b.id);
  });
  return ranked[0] ?? null;
};

/** 유형에서 문제를 여는 주소. 이미 통과한 문제를 다시 풀 때는 빈칸 채우기로 연다 */
export const skillProblemHref = (skillId: string, problem: SkillProblem, progress: Record<string, ProblemProgress>): string =>
  `/problems/${problem.id}?skill=${skillId}${problem.blanks && progress[problem.id]?.passed ? "&mode=blank" : ""}`;

/** 복습 시각이 지난 유형을 오래 밀린 순으로 */
export const dueSkills = (skills: SkillView[], store: Store, now: number): SkillView[] =>
  skills.filter((s) => store[s.id] && store[s.id].due <= now && s.problems.length > 0).sort((a, b) => store[a.id].due - store[b.id].due);
