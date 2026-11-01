"use client";
import { useSyncExternalStore } from "react";

const QUERY = "(min-width: 1024px)";
const subscribe = (cb: () => void) => {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

/** 3열 레이아웃을 쓸 수 있는 폭인지. 서버 렌더는 데스크톱으로 가정한다. */
export const useDesktop = (): boolean => useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => true);
