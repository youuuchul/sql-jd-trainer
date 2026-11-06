import type { CSSProperties, ReactNode } from "react";

/**
 * 진행 링. 가운데에 children 을 둔다.
 *
 * Args:
 *   value: 0~1. 범위를 벗어나면 자른다.
 *   size: 지름 px.
 *   stroke: 선 굵기(viewBox 100 기준). 기본 9.
 *   track: 바탕 링 색(CSS 색). 기본 surface-3.
 *   bar: 진행 색. 기본 accent.
 *   label: 접근성 이름. 주면 role="progressbar".
 */
export function ProgressRing({ value, size = 96, stroke = 9, track, bar, label, className = "", children }: { value: number; size?: number; stroke?: number; track?: string; bar?: string; label?: string; className?: string; children?: ReactNode }) {
  const r = 50 - stroke / 2 - 1;
  const c = 2 * Math.PI * r;
  const v = Math.min(Math.max(value, 0), 1);
  const style = { width: size, height: size, "--ring-trk": track, "--ring-bar": bar } as CSSProperties;
  return (
    <div className={`hq-ring ${className}`} style={style} {...(label ? { role: "progressbar", "aria-label": label, "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": Math.round(v * 100) } : {})}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle className="trk" cx="50" cy="50" r={r} strokeWidth={stroke} />
        {v > 0 && <circle className="bar" cx="50" cy="50" r={r} strokeWidth={stroke} strokeDasharray={`${(c * v).toFixed(2)} ${c.toFixed(2)}`} />}
      </svg>
      {children !== undefined && <div className="hq-ring-c">{children}</div>}
    </div>
  );
}
