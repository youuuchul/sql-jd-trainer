"use client";
import { useState } from "react";
import { Accordion } from "@/components/ui-lab/components/accordion/Accordion";
import { Badge } from "@/components/ui-lab/components/badge/Badge";
import type { SchemaDef, SeedTable } from "@/lib/content/types";
import { ResultGrid } from "./ResultGrid";

const TYPE_LABEL: Record<SeedTable["columns"][number]["type"], string> = { int: "int", bigint: "bigint", decimal: "decimal", text: "text", date: "date", timestamp: "timestamp", bool: "bool" };

function TableCard({ table }: { table: SeedTable }) {
  const [showRows, setShowRows] = useState(false);
  return (
    <div className="space-y-2">
      {table.grain && <p className="text-xs text-muted">단위: {table.grain}</p>}
      <ul className="divide-y divide-line rounded-xl border border-line">
        {table.columns.map((c) => (
          <li key={c.name} className="flex items-start justify-between gap-3 px-3 py-1.5">
            <div className="min-w-0">
              <span className="font-mono text-[12.5px] text-fg">{c.name}</span>
              {c.description && <p className="text-[11.5px] text-muted">{c.description}</p>}
            </div>
            <span className="shrink-0 font-mono text-[11px] text-muted">{TYPE_LABEL[c.type]}</span>
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => setShowRows((v) => !v)} className="text-xs text-accent hover:underline">
        {showRows ? "샘플 숨기기" : `샘플 5행 보기 (전체 ${table.rows.length.toLocaleString()}행)`}
      </button>
      {showRows && (
        <div className="rounded-xl border border-line">
          <ResultGrid columns={table.columns.map((c) => c.name)} rows={table.rows.slice(0, 5)} caption={`${table.name} 샘플`} />
        </div>
      )}
    </div>
  );
}

export function SchemaPanel({ schema }: { schema: SchemaDef }) {
  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">{schema.title}</h2>
          <Badge size="sm">{schema.domain}</Badge>
        </div>
        {schema.notes.length > 0 && (
          <ul className="mt-2 list-disc space-y-1 pl-4 text-[12.5px] leading-relaxed text-fg/75">
            {schema.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        )}
      </div>
      {schema.metrics.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">지표 정의</h3>
          <ul className="space-y-1.5">
            {schema.metrics.map((m) => (
              <li key={m.name} className="rounded-xl border border-line bg-surface px-3 py-2">
                <p className="text-[12.5px] font-medium">{m.name}</p>
                <p className="text-[12px] leading-relaxed text-muted">{m.definition}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section>
        <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">테이블 {schema.tables.length}개</h3>
        <Accordion
          type="multiple"
          items={schema.tables.map((t) => ({
            value: t.name,
            title: (
              <span className="flex items-center gap-2">
                <span className="font-mono text-[13px]">{t.name}</span>
                {t.description && <span className="text-xs font-normal text-muted">{t.description}</span>}
              </span>
            ),
            content: <TableCard table={t} />,
          }))}
        />
      </section>
    </div>
  );
}
