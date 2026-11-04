"use client";
import { useCallback, useSyncExternalStore } from "react";
import { dayKey, schedule, type CardState, type DialectFilter, type Outcome } from "./srs";

export interface DayLog {
  answered: number;
  correct: number;
}

export interface DailySettings {
  goal: number;
  dialect: DialectFilter;
}

export interface DailyStore {
  cards: Record<string, CardState>;
  days: Record<string, DayLog>;
  settings: DailySettings;
}

const KEY = "sjt:daily:v1";
export const DEFAULT_SETTINGS: DailySettings = { goal: 10, dialect: "all" };
const EMPTY: DailyStore = { cards: {}, days: {}, settings: DEFAULT_SETTINGS };
const listeners = new Set<() => void>();
let cache: DailyStore | null = null;

const read = (): DailyStore => {
  if (cache) return cache;
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? "null") as Partial<DailyStore> | null;
    cache = { cards: raw?.cards ?? {}, days: raw?.days ?? {}, settings: { ...DEFAULT_SETTINGS, ...raw?.settings } };
  } catch {
    cache = EMPTY;
  }
  return cache;
};

const write = (next: DailyStore) => {
  cache = next;
  window.localStorage.setItem(KEY, JSON.stringify(next));
  listeners.forEach((l) => l());
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    cache = null;
    l();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
};

export const useDailyStore = () => {
  const store = useSyncExternalStore(subscribe, read, () => EMPTY);
  /** firstTry 가 false 인 재도전은 복습 일정만 바꾸고 하루 기록에는 세지 않는다 */
  const record = useCallback((cardId: string, outcome: Outcome, now: number, firstTry: boolean) => {
    const prev = read();
    const day = dayKey(now);
    const log = prev.days[day] ?? { answered: 0, correct: 0 };
    write({
      ...prev,
      cards: { ...prev.cards, [cardId]: schedule(prev.cards[cardId], outcome, now) },
      days: firstTry ? { ...prev.days, [day]: { answered: log.answered + 1, correct: log.correct + (outcome === "correct" ? 1 : 0) } } : prev.days,
    });
  }, []);
  const updateSettings = useCallback((patch: Partial<DailySettings>) => {
    const prev = read();
    write({ ...prev, settings: { ...prev.settings, ...patch } });
  }, []);
  return { store, record, updateSettings };
};

let clock = 0;
const clockListeners = new Set<() => void>();
const subscribeClock = (l: () => void) => {
  clockListeners.add(l);
  clock = Date.now();
  const id = window.setInterval(() => {
    clock = Date.now();
    l();
  }, 60000);
  return () => {
    clockListeners.delete(l);
    window.clearInterval(id);
  };
};

/** 렌더 중에 Date.now() 를 부르지 않도록 구독 시점과 1분마다 갱신되는 시각. 서버·하이드레이션에서는 0 */
export const useNow = () => {
  const now = useSyncExternalStore(subscribeClock, () => clock, () => 0);
  const refresh = useCallback(() => {
    clock = Date.now();
    clockListeners.forEach((l) => l());
  }, []);
  return [now, refresh] as const;
};
