"use client";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Selecky } from "@/components/selecky/Selecky";
import { Button } from "@/components/ui/Button";
import { MockExam } from "@/components/workspace/MockExam";
import type { Problem, SchemaDef } from "@/lib/content/types";
import { JD_MOCK_MAX_MIN, JD_MOCK_SET_ID, JD_MOCK_SET_KEY, parseJdMockSet } from "@/lib/jd/mock-set";

const TITLE = "공고 추천 모의 시험";
const subscribe = () => () => {};
const readRaw = () => window.localStorage.getItem(JD_MOCK_SET_KEY);

type Loaded = { key: string; problems: Problem[]; schemas: SchemaDef[] } | { key: string; error: true };

/** 공고 분석에서 저장한 추천 문제로 기존 모의 시험을 연다. 문제 본문은 서버가 잠긴 문제를 뺀 뒤 돌려준다 */
export function JdMockExam() {
  const raw = useSyncExternalStore(subscribe, readRaw, () => undefined);
  const saved = useMemo(() => (raw === undefined ? undefined : parseJdMockSet(raw)), [raw]);
  const key = saved?.problems.join(",") ?? "";
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/mock-set?ids=${encodeURIComponent(key)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { problems: Problem[]; schemas: SchemaDef[] };
        if (!cancelled) setLoaded({ key, ...data });
      } catch {
        if (!cancelled) setLoaded({ key, error: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [key]);

  if (saved === undefined || (key && loaded?.key !== key)) return <div className="flex-1" />;
  if (loaded && "error" in loaded) return <Notice message="문제를 불러오지 못했습니다." />;
  if (!key || !loaded?.problems.length) return <Notice message="저장된 추천 문제가 없습니다." />;
  const timeLimitMin = Math.min(JD_MOCK_MAX_MIN, loaded.problems.reduce((a, p) => a + (p.timeLimitMin ?? 10), 0));
  return (
    <MockExam
      set={{ id: JD_MOCK_SET_ID, title: TITLE, description: saved!.competencies.join(" · "), timeLimitMin }}
      problems={loaded.problems}
      schemas={loaded.schemas}
      backHref="/jd"
    />
  );
}

function Notice({ message }: { message: string }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-5 px-5 py-12 text-center">
      <Selecky motion="C5" />
      <div>
        <h1 className="text-[22px] font-extrabold tracking-[-0.02em]">{TITLE}</h1>
        <p className="mt-2 text-[15px] text-fg-2">{message}</p>
      </div>
      <Button href="/jd">공고 분석으로</Button>
    </div>
  );
}
