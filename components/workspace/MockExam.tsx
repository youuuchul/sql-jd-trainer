"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui-lab/components/button/Button";
import { Badge } from "@/components/ui-lab/components/badge/Badge";
import type { Problem, ProblemSet, SchemaDef } from "@/lib/content/types";
import { Workspace } from "./Workspace";

interface Attempt {
  passed: boolean;
  tries: number;
  firstPassAt?: number;
}

const fmtClock = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;

export function MockExam({ set, problems, schema }: { set: ProblemSet; problems: Problem[]; schema: SchemaDef }) {
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
      <div className="mx-auto w-full max-w-2xl px-5 py-12">
        <Badge tone="accent" size="sm">
          모의 시험
        </Badge>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">{set.title}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-fg/85">{set.description}</p>
        <ul className="mt-6 space-y-2 text-sm text-fg/80">
          <li>문제 {problems.length}개, 제한 시간 {Math.round(totalSec / 60)}분. 시간이 끝나면 자동으로 종료됩니다.</li>
          <li>시험 중에는 해설과 기대 결과를 볼 수 없습니다. 실행 결과와 채점 여부만 표시됩니다.</li>
          <li>문제는 건너뛰었다가 돌아올 수 있습니다. 종료 후 문제별 결과와 해설 링크가 나옵니다.</li>
        </ul>
        <ol className="mt-6 divide-y divide-line rounded-card border border-line bg-surface">
          {problems.map((p, i) => (
            <li key={p.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span>
                <span className="mr-2 font-mono text-xs text-muted">{i + 1}</span>
                {p.title}
              </span>
              <span className="text-xs text-muted">{p.timeLimitMin ?? 10}분</span>
            </li>
          ))}
        </ol>
        <Button
          className="mt-8"
          size="lg"
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
      <div className="mx-auto w-full max-w-2xl px-5 py-12">
        <h1 className="text-2xl font-semibold tracking-tight">결과</h1>
        <p className="mt-2 text-[15px] text-fg/85">
          {problems.length}문제 중 {passedCount}문제 정답. 소요 {fmtClock(Math.min(elapsed, totalSec))}.
        </p>
        <ol className="mt-6 divide-y divide-line rounded-card border border-line bg-surface">
          {summary.map(({ p, a }, i) => (
            <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <div className="min-w-0">
                <span className="mr-2 font-mono text-xs text-muted">{i + 1}</span>
                <Link href={`/problems/${p.id}`} className="hover:underline">
                  {p.title}
                </Link>
                <p className="text-xs text-muted">시도 {a?.tries ?? 0}회{a?.firstPassAt ? ` · 정답까지 ${fmtClock(Math.floor((a.firstPassAt - startedAt) / 1000))}` : ""}</p>
              </div>
              <Badge tone={a?.passed ? "success" : a?.tries ? "danger" : "neutral"} size="sm">
                {a?.passed ? "정답" : a?.tries ? "오답" : "미제출"}
              </Badge>
            </li>
          ))}
        </ol>
        <div className="mt-8 flex gap-3">
          <Button
            variant="secondary"
            onClick={() => {
              setAttempts({});
              setIdx(0);
              setPhase("intro");
            }}
          >
            다시 보기
          </Button>
          <Link href={`/sets/${set.id}`} className="inline-flex h-10 items-center rounded-xl px-4 text-sm font-semibold text-fg/80 hover:bg-fg/10">
            문제 목록으로
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="sticky top-14 z-20 border-b border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-5 py-2">
          <div className="flex items-center gap-1">
            {problems.map((p, i) => {
              const a = attempts[p.id];
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setIdx(i)}
                  aria-current={i === idx ? "step" : undefined}
                  className={`h-8 min-w-8 rounded-lg px-2 font-mono text-xs transition-colors ${i === idx ? "bg-accent text-white" : a?.passed ? "bg-pass/20 text-pass" : a?.tries ? "bg-fail/20 text-fail" : "bg-fg/10 text-fg/70 hover:bg-fg/15"}`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-4">
            <span className={`font-mono text-sm tabular-nums ${remaining < 300 ? "text-fail" : "text-fg"}`} aria-live="polite">
              남은 시간 {fmtClock(remaining)}
            </span>
            <Button size="sm" variant="secondary" onClick={() => setPhase("done")}>
              시험 종료
            </Button>
          </div>
        </div>
      </div>
      <Workspace
        key={problem.id}
        problem={problem}
        schema={schema}
        mode="mock"
        index={idx}
        total={problems.length}
        onGraded={onGraded}
        footer={
          <div className="flex justify-between">
            <Button size="sm" variant="ghost" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)}>
              이전 문제
            </Button>
            {idx < problems.length - 1 ? (
              <Button size="sm" variant="secondary" onClick={() => setIdx((i) => i + 1)}>
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
  );
}
