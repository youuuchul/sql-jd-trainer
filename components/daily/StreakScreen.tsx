"use client";
import { Selecky } from "@/components/selecky/Selecky";
import { useHideTabBar } from "@/components/shell/tabbar";
import { Button } from "@/components/ui/Button";
import { WeekStrip, type WeekDay } from "@/components/home/WeekStrip";

export interface StreakSummary {
  solved: number;
  correct: number;
  hinted: number;
  wrong: number;
}

/** 오늘 목표를 채운 뒤 연속 일수 화면 */
export function StreakScreen({ days, week, summary, goal, canMore, onContinue, onMore }: { days: number; week: WeekDay[]; summary: StreakSummary; goal: number; canMore: boolean; onContinue: () => void; onMore: () => void }) {
  useHideTabBar();
  const cells: [string, number, string][] = [
    ["푼 카드", summary.solved, ""],
    ["정답", summary.correct, "text-pass"],
    ["힌트 정답", summary.hinted, ""],
    ["오답", summary.wrong, "text-fail"],
  ];
  return (
    <div className="flex flex-1 flex-col items-center bg-[radial-gradient(90%_55%_at_50%_22%,#FFE2C2_0%,var(--color-bg)_70%)] px-5 pt-8 pb-6 dark:bg-[radial-gradient(75%_40%_at_50%_21%,rgb(255_138_31/.22),rgb(255_138_31/0)_72%)]">
      <div className="mt-6 lg:mt-10">
        <Selecky motion="C4" size={160} />
      </div>
      <p className="mt-[18px] flex items-baseline gap-1.5 text-flame" role="status">
        <b className="text-[104px] leading-[0.9] font-black tracking-[-0.06em] tabular-nums">{days}</b>
        <span className="text-2xl font-extrabold tracking-[-0.03em] text-fg">일 연속</span>
      </p>
      <section aria-label="이번 주" className="mt-[26px] w-full max-w-lg rounded-[22px] bg-surface px-3.5 pt-4 pb-3.5 shadow-[inset_0_0_0_1.5px_var(--color-line),0_4px_0_var(--color-line)] dark:shadow-[inset_0_0_0_1px_var(--color-line)]">
        <WeekStrip days={week} ratio={1} glow />
        <dl className="m-0 mt-3.5 grid grid-cols-4 border-t border-line pt-3">
          {cells.map(([label, value, tone]) => (
            <div key={label} className="grid justify-items-center gap-0.5">
              <dt className="order-2 text-[11.5px] font-semibold text-muted">{label}</dt>
              <dd className={`order-1 m-0 text-xl font-extrabold tabular-nums ${tone}`}>{value}</dd>
            </div>
          ))}
        </dl>
      </section>
      {summary.wrong > 0 && <p className="mt-3.5 text-[13px] font-semibold text-warn">틀린 카드는 5분 뒤 복습 대기열로 돌아옵니다</p>}
      <div className="mt-auto grid w-full max-w-lg gap-3 pt-8">
        <Button full onClick={onContinue}>
          계속
        </Button>
        {canMore && (
          <Button full tone="ghost" onClick={onMore}>
            {goal}장 더 풀기
          </Button>
        )}
      </div>
    </div>
  );
}
