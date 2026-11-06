"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BackButton } from "@/components/practice/SolveHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { FORMAT_ICON, Icon } from "@/components/ui/icons";
import { ProgressRing } from "@/components/ui/ProgressRing";
import type { Problem, ProblemSet, SchemaDef } from "@/lib/content/types";
import { Workspace } from "./Workspace";

interface Attempt {
  passed: boolean;
  tries: number;
  firstPassAt?: number;
}

const fmtClock = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;

/** schemas: 문제들이 쓰는 스키마. 문제마다 problem.schema 로 고른다. backHref: 결과 화면의 "문제 목록으로" 링크 */
export function MockExam({
  set,
  problems,
  schemas,
  backHref = `/sets/${set.id}`,
}: {
  set: Pick<ProblemSet, "id" | "title" | "description" | "timeLimitMin">;
  problems: Problem[];
  schemas: SchemaDef[];
  backHref?: string;
}) {
  const totalSec = (set.timeLimitMin ?? problems.reduce((a, p) => a + (p.timeLimitMin ?? 10), 0)) * 60;
  const [phase, setPhase] = useState<"intro" | "running" | "done">("intro");
  const [idx, setIdx] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(0);
  const [attempts, setAttempts] = useState<Record<string, Attempt>>({});

  useEffect(() => {
    if (phase !== "running") return;
    const t = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current - startedAt >= totalSec * 1000) setPhase("done");
    }, 1000);
    return () => clearInterval(t);
  }, [phase, startedAt, totalSec]);

  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
  const remaining = Math.max(0, totalSec - elapsed);

  const problem = problems[idx];
  const problemId = problem.id;
  const onGraded = useCallback(
    (passed: boolean) => {
      setAttempts((a) => {
        const prev = a[problemId] ?? { passed: false, tries: 0 };
        return { ...a, [problemId]: { passed: prev.passed || passed, tries: prev.tries + 1, firstPassAt: prev.firstPassAt ?? (passed ? Date.now() : undefined) } };
      });
    },
    [problemId],
  );

  const summary = useMemo(() => problems.map((p) => ({ p, a: attempts[p.id] })), [problems, attempts]);
  const passedCount = summary.filter((s) => s.a?.passed).length;

  if (phase === "intro") {
    return (
      <div className="mx-auto w-full max-w-2xl px-5 py-6 lg:py-10">
        <BackHeader href={backHref} />
        <Chip tone="accent" size="sm" className="mt-5">
          모의 시험
        </Chip>
        <h1 className="mt-3 text-2xl leading-[1.3] font-extrabold tracking-[-0.03em]">{set.title}</h1>
        {set.description && <p className="mt-2 text-[15px] leading-[1.6] font-medium text-fg-2">{set.description}</p>}
        <Card flat className="mt-5 flex items-center gap-3 px-4 py-3.5">
          <Icon name="timer" size={20} className="text-accent" />
          <div className="min-w-0">
            <p className="text-[15px] font-extrabold">
              문제 {problems.length}개, 제한 시간 {Math.round(totalSec / 60)}분
            </p>
            <p className="text-[12.5px] font-medium text-muted">시간이 끝나면 자동으로 종료되고, 시험 중에는 해설과 기대 결과가 보이지 않습니다.</p>
          </div>
        </Card>
        <ol className="mt-4 space-y-2">
          {problems.map((p, i) => (
            <li key={p.id} className="flex items-center gap-3 rounded-2xl bg-surface px-3.5 py-3 ring-1 ring-line ring-inset">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-surface-2 font-mono text-[13px] font-bold text-muted">{i + 1}</span>
              <span className="min-w-0 flex-1 text-[14.5px] font-bold">{p.title}</span>
              <span className="shrink-0 font-mono text-xs font-semibold text-muted">{p.timeLimitMin ?? 10}분</span>
            </li>
          ))}
        </ol>
        <Button
          className="mt-7"
          full
          onClick={() => {
            setStartedAt(Date.now());
            setNow(Date.now());
            setPhase("running");
          }}
        >
          시작
        </Button>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className="mx-auto w-full max-w-2xl px-5 py-6 lg:py-10">
        <BackHeader href={backHref} />
        <Card className="mt-5 flex items-center gap-5 p-5">
          <ProgressRing value={problems.length ? passedCount / problems.length : 0} size={88} stroke={10} label="정답 비율">
            <span className="font-mono text-lg font-extrabold">
              {passedCount}/{problems.length}
            </span>
          </ProgressRing>
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold tracking-[-0.03em]">결과</h1>
            <p className="mt-1 text-[15px] font-medium text-fg-2">
              {problems.length}문제 중 {passedCount}문제 정답. 소요 {fmtClock(Math.min(elapsed, totalSec))}.
            </p>
          </div>
        </Card>
        <ol className="mt-4 space-y-2">
          {summary.map(({ p, a }, i) => (
            <li key={p.id} className="flex items-center gap-3 rounded-2xl bg-surface px-3.5 py-3 ring-1 ring-line ring-inset">
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${a?.passed ? "bg-pass-soft text-pass-ink" : a?.tries ? "bg-fail-soft text-fail-ink" : "bg-surface-2 text-muted"}`}>
                <Icon name={a?.passed ? "check" : FORMAT_ICON[p.format]} size={17} strokeWidth={a?.passed ? 2.6 : 1.85} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14.5px] font-bold">
                  <span className="mr-2 font-mono text-xs text-muted">{i + 1}</span>
                  <Link href={`/problems/${p.id}`} className="hover:underline">
                    {p.title}
                  </Link>
                </p>
                <p className="text-xs font-medium text-muted">시도 {a?.tries ?? 0}회{a?.firstPassAt ? ` · 정답까지 ${fmtClock(Math.floor((a.firstPassAt - startedAt) / 1000))}` : ""}</p>
              </div>
              <Chip tone={a?.passed ? "pass" : a?.tries ? "fail" : "neutral"} size="sm">
                {a?.passed ? "정답" : a?.tries ? "오답" : "미제출"}
              </Chip>
            </li>
          ))}
        </ol>
        <div className="mt-7 flex gap-3">
          <Button
            tone="ghost"
            onClick={() => {
              setAttempts({});
              setIdx(0);
              setPhase("intro");
            }}
          >
            다시 보기
          </Button>
          <Button href={backHref} tone="ghost" className="border-0">
            문제 목록으로
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh">
      <div className="sticky top-[env(safe-area-inset-top)] z-20 shrink-0 border-b border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5 lg:px-5">
          <div className="flex items-center gap-1.5">
            {problems.map((p, i) => {
              const a = attempts[p.id];
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setIdx(i)}
                  aria-current={i === idx ? "step" : undefined}
                  className={`h-8 min-w-8 rounded-[10px] px-2 font-mono text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-accent ${i === idx ? "bg-accent text-on-accent shadow-[0_2px_0_var(--color-accent-deep)]" : a?.passed ? "bg-pass-soft text-pass-ink" : a?.tries ? "bg-fail-soft text-fail-ink" : "bg-surface-2 text-fg-2 hover:bg-surface-3"}`}
                >
                  {i + 1}
                </button>
              );
            })}
            <span className="ml-1.5 font-mono text-[12.5px] text-muted">
              {idx + 1} / {problems.length}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className={`flex items-center gap-1.5 font-mono text-sm font-bold tabular-nums ${remaining < 300 ? "text-fail" : "text-fg"}`} aria-live="polite">
              <Icon name="timer" size={17} />
              <span>남은 시간 {fmtClock(remaining)}</span>
            </span>
            <Button size="xs" tone="ghost" onClick={() => setPhase("done")}>
              시험 종료
            </Button>
          </div>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <Workspace
          key={problem.id}
          problem={problem}
          schema={schemas.find((s) => s.id === problem.schema)!}
          mode="mock"
          onGraded={onGraded}
          footer={
            <div className="flex justify-between">
              <Button size="sm" tone="ghost" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)}>
                이전 문제
              </Button>
              {idx < problems.length - 1 ? (
                <Button size="sm" tone="ghost" onClick={() => setIdx((i) => i + 1)}>
                  다음 문제
                </Button>
              ) : (
                <Button size="sm" onClick={() => setPhase("done")}>
                  제출하고 종료
                </Button>
              )}
            </div>
          }
        />
      </div>
    </div>
  );
}

function BackHeader({ href }: { href: string }) {
  return (
    <div className="flex">
      <BackButton href={href} />
    </div>
  );
}
