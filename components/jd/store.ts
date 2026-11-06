import { useSyncExternalStore } from "react";

/** localStorage 한 키를 구독하는 문자열 저장소. 서버·하이드레이션 중에는 null 이라 저장값을 아직 모르는 상태를 구분한다. */
export function createLocalStore(key: string) {
  const listeners = new Set<() => void>();
  const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  };
  const read = () => window.localStorage.getItem(key) ?? "";
  const write = (value: string) => {
    window.localStorage.setItem(key, value);
    listeners.forEach((l) => l());
  };
  const useValue = (): string | null => useSyncExternalStore(subscribe, read, () => null);
  return { useValue, write };
}

export const jdTextStore = createLocalStore("sjt:jd:v1");
export const jdRecentStore = createLocalStore("sjt:jd:recent:v1");

export interface RecentItem {
  kind: "link" | "search";
  title: string;
  sub: string;
  url: string;
}

const MAX_RECENT = 5;

export const parseRecent = (raw: string | null): RecentItem[] => {
  try {
    const v = JSON.parse(raw || "[]") as unknown;
    if (!Array.isArray(v)) return [];
    return v.filter((r): r is RecentItem => typeof r?.url === "string" && typeof r?.title === "string" && typeof r?.sub === "string" && (r.kind === "link" || r.kind === "search")).slice(0, MAX_RECENT);
  } catch {
    return [];
  }
};

/** 최근 목록 맨 앞에 넣는다. 같은 주소는 하나로 합친다. */
export const pushRecent = (current: string | null, item: RecentItem) => {
  const next = [item, ...parseRecent(current).filter((r) => r.url !== item.url)].slice(0, MAX_RECENT);
  jdRecentStore.write(JSON.stringify(next));
};
