"use client";
import { useEffect, useSyncExternalStore } from "react";

let hidden = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/**
 * 마운트된 동안 모바일 아래 탭을 숨긴다(카드 풀이처럼 경로가 같은 몰입 화면용).
 *
 * Args:
 *   active: false 면 아무것도 하지 않는다.
 */
export const useHideTabBar = (active = true) => {
  useEffect(() => {
    if (!active) return;
    hidden += 1;
    emit();
    return () => {
      hidden -= 1;
      emit();
    };
  }, [active]);
};

export const useTabBarHidden = () => useSyncExternalStore(subscribe, () => hidden > 0, () => false);
