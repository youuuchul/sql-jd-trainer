"use client";
import { useCallback, useSyncExternalStore } from "react";
import type { Dialect } from "@/lib/content/types";

export interface ProblemProgress {
  passed: boolean;
  attempts: number;
  sql: Partial<Record<Dialect, string>>;
  passedAt?: string;
  mcqAnswer?: string[];
  /** 출력 예측 입력 텍스트 */
  predictAnswer?: string;
  /** 결과 이상 찾기에서 고른 행 인덱스 */
  spotRows?: number[];
}

type Store = Record<string, ProblemProgress>;

const KEY = "sjt:progress:v1";
const DIALECT_KEY = "sjt:dialect";
const listeners = new Set<() => void>();
let cache: Store | null = null;
const EMPTY: Store = {};

const read = (): Store => {
  if (cache) return cache;
  if (typeof window === "undefined") return EMPTY;
  try {
    cache = JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as Store;
  } catch {
    cache = {};
  }
  return cache;
};

const write = (next: Store) => {
  cache = next;
  window.localStorage.setItem(KEY, JSON.stringify(next));
  listeners.forEach((l) => l());
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const useProgressStore = (): Store => useSyncExternalStore(subscribe, read, () => EMPTY);

export const useProblemProgress = (problemId: string) => {
  const store = useProgressStore();
  const current = store[problemId] ?? { passed: false, attempts: 0, sql: {} };
  const update = useCallback(
    (patch: Partial<ProblemProgress> | ((p: ProblemProgress) => Partial<ProblemProgress>)) => {
      const prev = read()[problemId] ?? { passed: false, attempts: 0, sql: {} };
      const next = typeof patch === "function" ? patch(prev) : patch;
      write({ ...read(), [problemId]: { ...prev, ...next } });
    },
    [problemId],
  );
  return [current, update] as const;
};

const dialectListeners = new Set<() => void>();
const readDialect = (): Dialect => {
  const v = window.localStorage.getItem(DIALECT_KEY);
  return v === "bigquery" || v === "mysql" ? v : "postgres";
};
const subscribeDialect = (l: () => void) => {
  dialectListeners.add(l);
  return () => dialectListeners.delete(l);
};

/** 마지막으로 고른 방언. 서버 렌더는 postgres로 두고 클라이언트에서 저장값으로 맞춘다. */
export const useDialect = () => {
  const dialect = useSyncExternalStore(subscribeDialect, readDialect, () => "postgres" as Dialect);
  const setDialect = useCallback((d: Dialect) => {
    window.localStorage.setItem(DIALECT_KEY, d);
    dialectListeners.forEach((l) => l());
  }, []);
  return [dialect, setDialect] as const;
};
