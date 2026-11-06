"use client";
import { useMemo, useState } from "react";
import { SegmentedControl } from "@/components/ui-lab/components/segmented-control/SegmentedControl";
import { JdAnalysis } from "@/components/jd/JdAnalysis";
import { JdFinder, type CurrentJd } from "@/components/jd/JdFinder";
import { jdRecentStore, jdTextStore, pushRecent } from "@/components/jd/store";
import { analyzeJd, recommendProblems, type Competency, type ProblemSummary } from "@/lib/jd/match";

type Tab = "analyze" | "find";
const TABS = [
  { value: "analyze" as const, label: "분석" },
  { value: "find" as const, label: "공고 찾기" },
];

const LINK_ONLY = /^https?:\/\/\S+$/i;

/** 공고 탭 화면. 본문은 브라우저 저장소에만 두고, 링크만 붙이면 출처로만 저장한다. */
export function JdAnalyzer({ competencies, problems, minutes }: { competencies: Competency[]; problems: ProblemSummary[]; minutes: Record<string, number | null> }) {
  const saved = jdTextStore.useValue();
  const recentRaw = jdRecentStore.useValue();
  const [tab, setTab] = useState<Tab>("analyze");

  const matches = useMemo(() => (saved ? analyzeJd(saved, competencies) : null), [saved, competencies]);
  const recs = useMemo(() => (matches ? recommendProblems(matches, problems) : []), [matches, problems]);

  const submit = (raw: string) => {
    const text = raw.trim();
    if (LINK_ONLY.test(text)) {
      let host = text;
      try {
        host = new URL(text).hostname.replace(/^www\./, "");
      } catch {
        host = text;
      }
      pushRecent(recentRaw, { kind: "link", title: host, sub: "링크 · 출처로 저장", url: text });
      setTab("find");
      return;
    }
    jdTextStore.write(raw);
    setTab("analyze");
  };

  const current: CurrentJd | null = saved
    ? { title: saved.split("\n").find((l) => l.trim())?.trim().slice(0, 60) ?? "", sub: `붙여 넣기 · 역량 ${matches?.length ?? 0} · 추천 ${recs.length}` }
    : null;

  return (
    <div className="mx-auto w-full max-w-[1280px] px-5 pt-6 pb-32 lg:px-10 lg:py-8">
      <header className="flex items-center justify-between gap-3 lg:justify-start lg:gap-5">
        <h1 className="text-[28px] leading-none font-extrabold tracking-[-0.03em]">공고</h1>
        <SegmentedControl label="공고 보기" options={TABS} value={tab} onChange={setTab} className="w-[210px]" />
        {tab === "analyze" && matches && matches.length > 0 && (
          <span className="ml-auto hidden text-sm font-semibold text-muted lg:block">
            역량 {matches.length}개 · 추천 {recs.length}문제
          </span>
        )}
      </header>
      {saved === null ? null : tab === "analyze" ? (
        <JdAnalysis saved={saved} matches={matches} recs={recs} minutes={minutes} onSubmit={submit} />
      ) : (
        <JdFinder current={current} onOpenCurrent={() => setTab("analyze")} onSubmit={submit} />
      )}
    </div>
  );
}
