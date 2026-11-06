"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Selecky } from "@/components/selecky/Selecky";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";
import type { CompetencyMatch, Recommendation } from "@/lib/jd/match";
import { JD_MOCK_MAX_MIN, JD_MOCK_MAX_PROBLEMS, JD_MOCK_SET_ID, saveJdMockSet } from "@/lib/jd/mock-set";
import { HighlightedText } from "./highlight";
import { RecList } from "./RecList";

const SAVE_HINT = "본문은 이 브라우저에만 저장됩니다";

interface Props {
  saved: string;
  matches: CompetencyMatch[] | null;
  recs: Recommendation[];
  minutes: Record<string, number | null>;
  onSubmit: (text: string) => void;
}

/** 공고 분석 탭: 붙여 넣기, 요구 역량, 추천 문제, 모의 시험 시작 */
export function JdAnalysis({ saved, matches, recs, minutes, onSubmit }: Props) {
  const router = useRouter();
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? saved;
  const editing = !saved || draft !== null;

  const submit = () => {
    onSubmit(text);
    setDraft(null);
  };

  const paste = async () => {
    try {
      const clip = await navigator.clipboard.readText();
      if (clip) setDraft(clip);
    } catch {
      boxRef.current?.focus();
    }
  };

  const exam = recs.slice(0, JD_MOCK_MAX_PROBLEMS);
  const sum = exam.reduce((a, r) => a + (minutes[r.problem.id] ?? 10), 0);
  const limit = Math.min(JD_MOCK_MAX_MIN, sum);
  const startMock = () => {
    saveJdMockSet({ problems: exam.map((r) => r.problem.id), competencies: (matches ?? []).map((m) => m.competency.label) });
    router.push(`/mock/${JD_MOCK_SET_ID}`);
  };

  const editor = (
    <div className="hq-card p-4 lg:p-5">
      {saved && (
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[13px] font-semibold text-muted">공고 본문</span>
          <Button tone="ghost" size="xs" onClick={() => setDraft(null)}>
            취소
          </Button>
        </div>
      )}
      <textarea
        ref={boxRef}
        aria-label="채용 공고"
        value={text}
        onChange={(e) => setDraft(e.target.value)}
        rows={saved ? 14 : 9}
        placeholder="공고 본문 붙여 넣기"
        className="block w-full resize-none bg-transparent text-[15px] leading-[1.7] text-fg outline-none placeholder:text-faint"
      />
      <Button tone="ghost" size="sm" onClick={paste}>
        <Icon name="paste" size={18} />
        붙여 넣기
      </Button>
    </div>
  );

  if (!saved || editing) {
    return (
      <div className={`mx-auto w-full max-w-xl ${saved ? "mt-6" : "mt-4 lg:mt-8"}`}>
        {!saved && (
          <div className="flex flex-col items-center gap-5 pb-6 pt-4">
            <Selecky motion="C5" />
            <h2 className="text-[20px] font-extrabold tracking-[-0.02em]">채용 공고로 문제 고르기</h2>
          </div>
        )}
        {editor}
        <div className="mt-4 flex items-center gap-4">
          <Button onClick={submit} disabled={!text.trim()}>
            분석
          </Button>
          <span className="text-[13.5px] text-muted">{SAVE_HINT}</span>
        </div>
      </div>
    );
  }

  const keywords = (matches ?? []).flatMap((m) => m.matched);
  return (
    <div className="mt-5 grid grid-cols-1 gap-6 lg:mt-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start">
      <div className="hq-card p-4 lg:p-5">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold text-muted">공고 본문</span>
          <Button tone="ghost" size="xs" onClick={() => setDraft(saved)}>
            수정
          </Button>
        </div>
        <p className="mt-3 line-clamp-3 text-[15px] leading-[1.8] text-fg lg:line-clamp-none lg:whitespace-pre-wrap">
          <HighlightedText text={saved} keywords={keywords} />
        </p>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-6">
        {recs.length > 0 && (
          <div className="hidden items-center justify-between gap-4 rounded-[20px] bg-accent p-5 text-on-accent shadow-[0_4px_0_var(--color-accent-deep)] lg:flex">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold opacity-80">모의 시험 · 추천 앞 {exam.length}문제</p>
              <p className="mt-1 text-[26px] leading-tight font-extrabold tracking-[-0.03em]">
                {exam.length}문제 · {limit}분
              </p>
              {sum > JD_MOCK_MAX_MIN && (
                <p className="mt-2 text-[13px] opacity-80">
                  권장 시간 합계 {sum}분, 상한 {JD_MOCK_MAX_MIN}분
                </p>
              )}
            </div>
            <Button tone="inverse" onClick={startMock}>
              모의 시험 시작
            </Button>
          </div>
        )}

        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="text-[19px] font-extrabold tracking-[-0.02em]">요구 역량</h2>
            {matches && matches.length > 0 && <span className="text-sm font-semibold text-muted">{matches.length}</span>}
          </div>
          {matches?.length === 0 ? (
            <p className="mt-3 text-[14.5px] text-fg-2">공고에서 SQL 역량 키워드를 찾지 못했습니다.</p>
          ) : (
            <ul className="mt-3 flex flex-wrap gap-2">
              {matches?.map(({ competency, matched }) => (
                <li key={competency.id} className="flex items-center gap-2 rounded-full bg-accent-soft px-3.5 py-2 text-[14px] font-bold text-accent-ink">
                  {competency.label}
                  <span className="hidden text-[12.5px] font-medium text-muted lg:inline">{matched.join(", ")}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {recs.length > 0 && (
          <section>
            <div className="flex items-baseline justify-between">
              <h2 className="text-[19px] font-extrabold tracking-[-0.02em]">추천 문제</h2>
              <span className="text-sm font-semibold text-muted">{recs.length}</span>
            </div>
            <div className="mt-3">
              <RecList recs={recs} minutes={minutes} />
            </div>
          </section>
        )}
      </div>

      {recs.length > 0 && (
        <div className="hq-card fixed inset-x-3 bottom-[calc(68px+max(env(safe-area-inset-bottom),12px)+8px)] z-20 flex items-center gap-3 p-3 shadow-[inset_0_0_0_1.5px_var(--color-line),0_10px_28px_-8px_rgb(0_0_0/0.28)] lg:hidden">
          <div className="min-w-0 pl-2">
            <p className="text-[12.5px] text-muted">모의 시험</p>
            <p className="flex items-center gap-1.5 text-[17px] font-extrabold tracking-[-0.02em]">
              <Icon name="timer" size={18} className="text-accent" />
              {exam.length}문제 · {limit}분
            </p>
          </div>
          <Button full onClick={startMock} className="flex-1">
            모의 시험 시작
          </Button>
        </div>
      )}
    </div>
  );
}
