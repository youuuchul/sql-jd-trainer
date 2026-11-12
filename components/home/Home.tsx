"use client";
import Link from "next/link";
import type { RefObject } from "react";
import { Selecky } from "@/components/selecky/Selecky";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { Chip } from "@/components/ui/Chip";
import { SHELF_CLASS } from "@/components/skills/shelf";
import { FORMAT_ICON } from "@/components/ui/icons";
import { DIFFICULTY_LABEL, FORMAT_LABEL } from "@/lib/content/types";
import { usePath, type PathSet } from "@/lib/path";
import { useProgressStore } from "@/lib/progress";
import { dueSkills, nextInSkill, skillProblemHref, useSkillStore, type SkillProblem, type SkillView } from "@/lib/skills";
import { ResumeRow } from "./ResumeList";
import { WeekStrip, type WeekDay } from "./WeekStrip";

export interface HomeProps {
  /** 렌더 중 시각이 아직 정해지지 않았으면(서버·하이드레이션) false */
  ready: boolean;
  dateLabel: string;
  goal: number;
  answered: number;
  streak: number;
  dueCount: number;
  freshCount: number;
  masteredCount: number;
  week: WeekDay[];
  pathSets: PathSet[];
  skills: SkillView[];
  /** 현재 시각(ms). 정해지지 않았으면 0 */
  now: number;
  onStart: () => void;
  onOpenSettings: () => void;
  /** 설정 시트를 닫을 때 포커스가 돌아올 톱니 버튼 */
  gearRef: RefObject<HTMLButtonElement | null>;
}

const greeting = ({ ready, goal, answered, dueCount, freshCount }: HomeProps): string => {
  if (!ready) return " ";
  const remaining = Math.max(goal - answered, 0);
  if (remaining === 0) return `오늘 목표 ${goal}장을 채웠습니다`;
  if (!dueCount && !freshCount) return "지금 풀 카드가 없습니다";
  return `오늘 ${remaining}장 남았습니다`;
};

const HERO_VARS =
  "[--ring-trk:rgb(255_255_255/.24)] [--ring-bar:#fff] [--hsub:rgb(255_255_255/.74)] [--wk-off:rgb(255_255_255/.17)] [--wk-lbl:rgb(255_255_255/.72)] [--wk-today:#fff] " +
  "dark:[--ring-trk:var(--color-surface-3)] dark:[--ring-bar:var(--color-accent)] dark:[--hsub:var(--color-muted)] dark:[--wk-off:var(--color-surface-3)] dark:[--wk-lbl:var(--color-muted)] dark:[--wk-today:var(--color-fg)]";

/** 오늘 화면에 올리는 복습 유형 수 */
const MAX_REVIEW = 3;

/** 복습할 유형 한 줄. 그 유형에서 다음에 풀 문제로 이동한다 */
function ReviewRow({ skill, problem }: { skill: SkillView; problem: SkillProblem }) {
  const progress = useProgressStore();
  return (
    <Link
      href={skillProblemHref(skill.id, problem, progress)}
      className={`${SHELF_CLASS[skill.shelf]} flex items-center gap-3.5 rounded-[18px] bg-surface px-3.5 py-[13px] shadow-[inset_0_0_0_1.5px_var(--color-line),0_3px_0_var(--color-line)] dark:shadow-[inset_0_0_0_1px_var(--color-line)]`}
    >
      <span className="hq-catfill grid size-[46px] shrink-0 place-items-center rounded-[14px]">
        <Icon name={FORMAT_ICON[problem.format]} size={22} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="hq-catink block truncate text-xs font-bold">{skill.title}</span>
        <span className="block truncate text-[15.5px] leading-[1.35] font-bold tracking-[-0.02em]">{problem.title}</span>
        <span className="mt-px block truncate text-[12.5px] font-medium text-muted">
          {FORMAT_LABEL[problem.format]} · {DIFFICULTY_LABEL[problem.difficulty]}
          {problem.timeLimitMin ? ` · ${problem.timeLimitMin}분` : ""}
        </span>
      </span>
      <Chip tone="flame" size="sm">
        복습
      </Chip>
    </Link>
  );
}

export function Home(props: HomeProps) {
  const { ready, dateLabel, goal, answered, streak, dueCount, freshCount, masteredCount, week, pathSets, skills, now, onStart, onOpenSettings, gearRef } = props;
  const { next } = usePath(pathSets);
  const progress = useProgressStore();
  const reviews = useSkillStore();
  const due = (ready ? dueSkills(skills, reviews, now) : []).slice(0, MAX_REVIEW).flatMap((skill) => {
    const problem = nextInSkill(skill.problems, progress);
    return problem ? [{ skill, problem }] : [];
  });
  const canStart = dueCount + freshCount > 0;
  const remaining = Math.max(goal - answered, 0);
  const startLabel = !canStart ? "지금 풀 카드가 없습니다" : remaining === 0 ? `${goal}장 더 풀기` : answered ? "이어서 풀기" : "시작하기";

  return (
    <div className="mx-auto w-full max-w-lg px-5 pt-3 pb-4 lg:max-w-[1240px] lg:px-10 lg:py-8">
      <header className="flex items-center gap-3 pt-1 pb-4 lg:gap-[18px] lg:pb-[22px]">
        <span className="shrink-0 lg:mx-2 lg:origin-center lg:scale-[1.286]">
          <Selecky motion="C1" size={56} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="min-h-[1.3em] text-[13px] font-semibold text-muted lg:text-sm">{ready ? dateLabel : ""}</p>
          <h1 className="text-[21px] leading-[1.3] font-extrabold tracking-[-0.035em] lg:text-[28px] lg:leading-[1.25]">{greeting(props)}</h1>
        </div>
        {streak > 0 && (
          <span className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-flame-soft pr-3 pl-2 text-[17px] font-extrabold text-flame-deep lg:h-[42px] lg:pr-4 lg:pl-3 lg:text-base dark:text-flame">
            <Icon name="flame" size={21} filled className="text-flame" />
            <span className="tabular-nums">
              {streak}
              <span className="hidden lg:inline">일 연속</span>
              <span className="sr-only lg:hidden">일 연속</span>
            </span>
          </span>
        )}
        <button ref={gearRef} type="button" onClick={onOpenSettings} aria-label="설정" className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface text-fg-2 shadow-[inset_0_0_0_1.5px_var(--color-line-2),0_2px_0_var(--color-line-2)] dark:shadow-[inset_0_0_0_1px_var(--color-line-2)]">
          <Icon name="gear" size={21} />
        </button>
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)]">
        <section aria-label="오늘의 카드" className={`${HERO_VARS} relative grid grid-cols-[minmax(0,1fr)] content-start gap-4 rounded-3xl lg:content-between bg-accent p-[18px] pb-5 text-white shadow-[0_5px_0_var(--color-accent-deep)] lg:gap-5 lg:p-[24px_26px_26px] dark:bg-[radial-gradient(130%_110%_at_0%_0%,color-mix(in_srgb,var(--color-accent)_19%,var(--color-surface))_0%,var(--color-surface)_64%)] dark:text-fg dark:shadow-[inset_0_0_0_1px_var(--color-line)]`}>
          <div className="flex items-center gap-[18px] lg:gap-[26px]">
            <ProgressRing value={goal ? answered / goal : 0} size={92} stroke={10} label="오늘 푼 카드" className="lg:size-[124px]!">
              <b className="text-[30px] font-extrabold tracking-[-0.03em] tabular-nums lg:text-[40px]">{Math.min(answered, goal)}</b>
              <span className="mt-1 text-[13px] font-bold opacity-70 tabular-nums lg:text-sm">/ {goal}</span>
            </ProgressRing>
            <div className="min-w-0">
              <h2 className="mb-[9px] text-[19px] font-extrabold tracking-[-0.025em] lg:mb-3 lg:text-[22px]">오늘의 카드</h2>
              <dl className="m-0 flex gap-5 lg:gap-[30px]">
                {(
                  [
                    ["복습 대기", dueCount],
                    ["새 카드", freshCount],
                    ["익힌 카드", masteredCount],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="grid gap-px">
                    <dt className="order-2 text-[11.5px] font-semibold text-[var(--hsub)] lg:text-[12.5px]">{label}</dt>
                    <dd className="order-1 m-0 text-xl leading-[1.15] font-extrabold tracking-[-0.02em] tabular-nums lg:text-2xl">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
          <div className="grid gap-4 lg:mt-auto lg:grid-cols-[minmax(0,420px)_240px] lg:items-center lg:justify-between lg:gap-5">
            <WeekStrip days={ready ? week : week.map((d) => ({ ...d, on: false, today: false }))} ratio={goal ? answered / goal : 0} />
            <Button tone="inverse" full disabled={!canStart} onClick={onStart} className="dark:[--b:var(--color-accent)] dark:[--bd:var(--color-accent-deep)] dark:[--bf:var(--color-on-accent)]">
              {startLabel}
            </Button>
          </div>
        </section>

        {(due.length > 0 || next) && (
          <section aria-label="문제 복습" className="mt-1 lg:mt-0 lg:rounded-[18px] lg:bg-surface lg:p-5 lg:pb-3 lg:shadow-[inset_0_0_0_1.5px_var(--color-line),0_3px_0_var(--color-line)] lg:dark:shadow-[inset_0_0_0_1px_var(--color-line)]">
            <h3 className="mx-0.5 mb-2.5 text-[17px] font-extrabold tracking-[-0.02em]">{due.length ? "문제 복습" : "다음 문제"}</h3>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-2.5 lg:pb-2">
              {due.map(({ skill, problem }) => (
                <ReviewRow key={skill.id} skill={skill} problem={problem} />
              ))}
              {!due.length && next && <ResumeRow node={next} chip="다음" />}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
