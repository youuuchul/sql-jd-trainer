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

export function ResultGrid({ columns, rows, caption, highlight, truncated, emptyMessage = "결과가 없습니다.", selected, onToggle }: ResultGridProps) {
  const selectable = Boolean(onToggle);
  if (!columns.length) return <p className="px-4 py-6 text-sm text-muted">{emptyMessage}</p>;
  return (
    <div className="overflow-auto">
      <table className="w-max min-w-full border-collapse font-mono text-[12.5px]">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 bg-surface">
          <tr>
            {selectable && <th className="border-b border-line px-3 py-1.5 text-[11px] font-medium text-muted">선택</th>}
            <th className="border-b border-line px-3 py-1.5 text-right text-[11px] font-medium text-muted">#</th>
            {columns.map((c, i) => (
              <th key={i} className="border-b border-line px-3 py-1.5 text-left font-medium text-fg/90 whitespace-nowrap">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length + (selectable ? 2 : 1)} className="px-3 py-6 text-center text-sm text-muted">
                {emptyMessage}
              </td>
            </tr>
          )}
          {rows.map((r, i) => {
            const mark = highlight?.get(i);
            return (
              <tr
                key={i}
                onClick={selectable ? () => onToggle?.(i) : undefined}
                aria-selected={selectable ? selected?.has(i) : undefined}
                className={`${selectable ? "cursor-pointer hover:bg-fg/5" : ""} ${mark === "extra" ? "bg-diff-extra/15" : mark === "missing" ? "bg-diff-missing/15" : selected?.has(i) ? "bg-accent/10" : i % 2 ? "bg-fg/[0.02]" : ""}`}
              >
                {selectable && (
                  <td className="px-3 py-1 text-center">
                    <input type="checkbox" checked={selected?.has(i) ?? false} onChange={() => onToggle?.(i)} onClick={(e) => e.stopPropagation()} aria-label={`${i + 1}번째 행 선택`} className="accent-accent" />
                  </td>
                )}
                <td className="px-3 py-1 text-right text-[11px] text-muted">{i + 1}</td>
                {r.map((v, j) => (
                  <td key={j} className={`px-3 py-1 whitespace-nowrap ${v === null ? "text-muted italic" : typeof v === "number" ? "text-right tabular-nums" : ""}`}>
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
