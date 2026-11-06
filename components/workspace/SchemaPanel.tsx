"use client";
import { useState } from "react";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/icons";
import { UTabs, type UTabItem } from "@/components/practice/UTabs";
import type { SchemaDef, SeedTable } from "@/lib/content/types";
import { ResultGrid } from "./ResultGrid";

function TableCard({ table }: { table: SeedTable }) {
  const [open, setOpen] = useState(false);
  const [showRows, setShowRows] = useState(false);
  return (
    <li className="rounded-[14px] bg-surface-2">
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 px-3.5 py-3 text-left focus-visible:outline-2 focus-visible:outline-accent">
        <span className="min-w-0 flex-1">
          <span className="block font-mono text-[13px] font-semibold">{table.name}</span>
          {table.description && <span className="block text-[12.5px] font-medium text-muted">{table.description}</span>}
        </span>
        <Icon name="back" size={16} className={`shrink-0 text-faint transition-transform ${open ? "-rotate-90" : "rotate-180"}`} />
      </button>
      {open && (
        <div className="space-y-2 px-3.5 pb-3.5">
          {table.grain && <p className="text-xs font-medium text-muted">단위: {table.grain}</p>}
          <ul className="divide-y divide-line rounded-xl bg-surface ring-1 ring-line ring-inset">
            {table.columns.map((c) => (
              <li key={c.name} className="flex items-start justify-between gap-3 px-3 py-1.5">
                <div className="min-w-0">
                  <span className="font-mono text-[12.5px] text-fg">{c.name}</span>
                  {c.description && <p className="text-[11.5px] text-muted">{c.description}</p>}
                </div>
                <span className="shrink-0 font-mono text-[11px] text-muted">{c.type}</span>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setShowRows((v) => !v)} className="text-xs font-semibold text-accent-ink hover:underline">
            {showRows ? "샘플 숨기기" : `샘플 5행 보기 (전체 ${table.rows.length.toLocaleString()}행)`}
          </button>
          {showRows && (
            <div className="rounded-xl bg-surface ring-1 ring-line ring-inset">
              <ResultGrid columns={table.columns.map((c) => c.name)} rows={table.rows.slice(0, 5)} caption={`${table.name} 샘플`} />
            </div>
          )}
        </div>
      )}
    </li>
  );
}

/**
 * 스키마 패널: 데이터 규칙 · 지표 정의 · 테이블.
 *
 * Args:
 *   schema: 스키마 정의.
 *   focusText: 주면 이 글에 이름이 나오는 지표를 강조한다(문제 제목·태그 등).
 */
export function SchemaPanel({ schema, focusText = "" }: { schema: SchemaDef; focusText?: string }) {
  const haystack = focusText.toLowerCase();
  const items: UTabItem[] = [
    ...(schema.notes.length
      ? [
          {
            value: "notes",
            label: `데이터 규칙 ${schema.notes.length}`,
            content: (
              <ul className="space-y-2">
                {schema.notes.map((n, i) => (
                  <li key={i} className="rounded-[14px] bg-surface-2 px-3.5 py-3 text-[12.5px] leading-[1.55] font-medium text-fg-2">
                    {n}
                  </li>
                ))}
              </ul>
            ),
          },
        ]
      : []),
    ...(schema.metrics.length
      ? [
          {
            value: "metrics",
            label: `지표 정의 ${schema.metrics.length}`,
            content: (
              <ul className="space-y-2">
                {schema.metrics.map((m) => {
                  const hot = haystack.includes(m.name.toLowerCase());
                  return (
                    <li key={m.name} className={`rounded-[14px] px-3.5 py-3 ${hot ? "bg-note-bg shadow-[inset_3px_0_0_var(--color-cat-kpi)]" : "bg-surface-2"}`}>
                      <p className="text-sm font-extrabold">{m.name}</p>
                      <p className={`mt-[3px] text-[12.5px] leading-[1.55] font-medium ${hot ? "text-note-ink" : "text-muted"}`}>{m.definition}</p>
                    </li>
                  );
                })}
              </ul>
            ),
          },
        ]
      : []),
    {
      value: "tables",
      label: `테이블 ${schema.tables.length}`,
      content: (
        <ul className="space-y-2">
          {schema.tables.map((t) => (
            <TableCard key={t.name} table={t} />
          ))}
        </ul>
      ),
    },
  ];
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-extrabold tracking-[-0.02em]">{schema.title}</h2>
        <Chip size="sm">{schema.domain}</Chip>
      </div>
      <UTabs label="스키마 보기" size="sm" items={items} defaultValue={schema.metrics.length ? "metrics" : items[0].value} className="mt-3.5" panelClassName="pt-3" />
    </div>
  );
}
