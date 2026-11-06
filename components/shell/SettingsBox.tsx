"use client";
import { useEffect, useState } from "react";
import { DIALECT_LABEL } from "@/lib/content/types";
import { useDailyStore } from "@/lib/daily/store";

type PushState = "on" | "off" | null;

/** 알림 구독 여부만 읽는다. 서비스 워커가 없거나 지원하지 않으면 off */
const usePushState = (): PushState => {
  const [state, setState] = useState<PushState>(null);
  useEffect(() => {
    let cancelled = false;
    const read = async (): Promise<PushState> => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return "off";
      const reg = await navigator.serviceWorker.getRegistration();
      return (await reg?.pushManager.getSubscription()) ? "on" : "off";
    };
    read()
      .catch((): PushState => "off")
      .then((s) => {
        if (!cancelled) setState(s);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
};

/** 사이드바 아래 설정 상자: 하루 목표·방언·매일 알림의 저장값 */
export function SettingsBox({ className = "" }: { className?: string }) {
  const { store } = useDailyStore();
  const push = usePushState();
  const { goal, dialect } = store.settings;
  const rows: [string, string][] = [
    ["하루 목표", `${goal}장`],
    ["방언", dialect === "postgres" || dialect === "bigquery" ? DIALECT_LABEL[dialect] : "전체"],
    ["매일 알림", push === null ? "" : push === "on" ? "오전 9시" : "꺼짐"],
  ];
  return (
    <dl className={`rounded-2xl bg-surface p-3.5 shadow-[inset_0_0_0_1px_var(--color-line)] ${className}`}>
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between px-0.5 py-[5px] text-[13px]">
          <dt className="font-semibold text-muted">{k}</dt>
          <dd className="font-bold">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
