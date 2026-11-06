"use client";
import type { Cell } from "@/lib/content/types";

export interface ResultGridProps {
  columns: string[];
  rows: Cell[][];
  caption: string;
  /** 행 인덱스별 강조. extra=사용자 결과에만 있는 행, missing=기대에만 있는 행 */
  highlight?: Map<number, "extra" | "missing">;
  truncated?: boolean;
  emptyMessage?: string;
  /** 행 선택 모드. 체크박스 열이 앞에 붙는다. */
  selected?: Set<number>;
  onToggle?: (index: number) => void;
}

const fmt = (v: Cell): string => (v === null ? "NULL" : typeof v === "boolean" ? (v ? "true" : "false") : typeof v === "number" ? v.toLocaleString("ko-KR", { maximumFractionDigits: 6 }) : v);

const ROW_TONE = { extra: "bg-fail/[0.11]", missing: "bg-note/30 dark:bg-note/[0.13]" } as const;

export function ResultGrid({ columns, rows, caption, highlight, truncated, emptyMessage = "결과가 없습니다.", selected, onToggle }: ResultGridProps) {
  const selectable = Boolean(onToggle);
  if (!columns.length) return <p className="px-4 py-6 text-sm text-muted">{emptyMessage}</p>;
  return (
    <div className="overflow-auto">
      <table className="w-max min-w-full border-collapse font-mono text-[12.5px] leading-[1.2] [font-feature-settings:'tnum'_1]">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 bg-surface">
          <tr>
            {selectable && <th className="border-b border-line px-2.5 py-[9px] text-[11px] font-normal text-muted">선택</th>}
            <th className="w-7 border-b border-line py-[9px] pr-1 pl-2.5 text-right font-normal text-muted">#</th>
            {columns.map((c, i) => (
              <th key={i} className="border-b border-line px-2.5 py-[9px] text-left font-normal whitespace-nowrap text-muted">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length + (selectable ? 2 : 1)} className="px-3 py-6 text-center font-sans text-sm text-muted">
                {emptyMessage}
              </td>
            </tr>
          )}
          {rows.map((r, i) => {
            const mark = highlight?.get(i);
            const tone = mark ? ROW_TONE[mark] : selected?.has(i) ? "bg-accent-soft" : "";
            return (
              <tr key={i} onClick={selectable ? () => onToggle?.(i) : undefined} aria-selected={selectable ? selected?.has(i) : undefined} className={`${selectable ? "cursor-pointer hover:bg-surface-2" : ""} ${tone}`}>
                {selectable && (
                  <td className="border-b border-line/70 px-2.5 py-[9px] text-center">
                    <input type="checkbox" checked={selected?.has(i) ?? false} onChange={() => onToggle?.(i)} onClick={(e) => e.stopPropagation()} aria-label={`${i + 1}번째 행 선택`} className="h-4 w-4 accent-accent" />
                  </td>
                )}
                <td className="w-7 border-b border-line/70 py-[9px] pr-1 pl-2.5 text-right text-faint">{i + 1}</td>
                {r.map((v, j) => (
                  <td key={j} className={`border-b border-line/70 px-2.5 py-[9px] whitespace-nowrap ${v === null ? "text-muted italic" : typeof v === "number" ? "text-right tabular-nums" : ""}`}>
                    {fmt(v)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {truncated && <p className="px-3 py-2 text-xs text-muted">결과가 많아 500행까지만 표시합니다.</p>}
    </div>
  );
}
