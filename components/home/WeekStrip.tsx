import { Icon } from "@/components/ui/icons";
import { ProgressRing } from "@/components/ui/ProgressRing";

export interface WeekDay {
  label: string;
  /** 목표를 채운 날 */
  on: boolean;
  today: boolean;
}

/**
 * 주간 연속 띠(월~일). 목표를 채운 날은 불꽃색 체크, 오늘은 아직이면 진행 링.
 * 색 면 위에서는 부모가 --wk-off·--wk-lbl·--wk-today·--ring-trk·--ring-bar 를 정한다.
 *
 * Args:
 *   days: 요일별 상태.
 *   ratio: 오늘 진행(0~1). 오늘이 아직 안 채워졌을 때 링에 쓴다.
 *   glow: 오늘 점에 바깥 고리(연속 일수가 늘어난 날).
 */
export function WeekStrip({ days, ratio, glow = false }: { days: WeekDay[]; ratio: number; glow?: boolean }) {
  return (
    <ol aria-label="이번 주" className="m-0 grid list-none grid-cols-7 gap-0.5 p-0">
      {days.map((d) => (
        <li key={d.label} aria-current={d.today ? "date" : undefined} className={`grid justify-items-center gap-1.5 text-[11.5px] font-semibold ${d.today ? "text-[var(--wk-today,var(--color-fg))]" : "text-[var(--wk-lbl,var(--color-muted))]"}`}>
          <span>{d.label}</span>
          {d.today && !d.on ? (
            <ProgressRing value={ratio} size={30} stroke={12} />
          ) : (
            <span
              className={`grid size-[30px] place-items-center rounded-full ${d.on ? `bg-flame text-white shadow-[0_2px_0_var(--color-flame-deep)] ${glow && d.today ? "shadow-[0_2px_0_var(--color-flame-deep),0_0_0_5px_color-mix(in_srgb,var(--color-flame)_25%,transparent)]" : ""}` : "bg-[var(--wk-off,var(--color-surface-3))]"}`}
            >
              {d.on && <Icon name="check" size={15} strokeWidth={2.6} />}
            </span>
          )}
          <span className="sr-only">{d.on ? "완료" : d.today ? "진행 중" : "미완료"}</span>
        </li>
      ))}
    </ol>
  );
}
