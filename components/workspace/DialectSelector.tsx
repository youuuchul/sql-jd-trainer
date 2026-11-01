"use client";
import { SegmentedControl } from "@/components/ui-lab/components/segmented-control/SegmentedControl";
import { DIALECTS, DIALECT_LABEL, type Dialect } from "@/lib/content/types";
import type { EngineStatus } from "./useEngine";

const STATUS_LABEL: Record<EngineStatus["state"], string> = { loading: "엔진 준비 중", ready: "준비됨", error: "연결 실패" };

export function DialectSelector({ value, onChange, status }: { value: Dialect; onChange: (d: Dialect) => void; status: EngineStatus }) {
  const dot = status.state === "ready" ? "bg-pass" : status.state === "error" ? "bg-fail" : "bg-warn motion-safe:animate-pulse";
  return (
    <div className="flex flex-wrap items-center gap-3">
      <SegmentedControl<Dialect> label="SQL 방언" size="sm" value={value} onChange={onChange} options={DIALECTS.map((d) => ({ value: d, label: DIALECT_LABEL[d] }))} />
      <span className="flex items-center gap-1.5 text-xs text-muted" title={status.message}>
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden="true" />
        {STATUS_LABEL[status.state]}
        {status.state === "error" && status.message && <span className="max-w-[18rem] truncate text-fail">{status.message}</span>}
      </span>
    </div>
  );
}
