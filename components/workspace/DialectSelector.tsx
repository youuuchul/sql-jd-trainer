"use client";
import { SegmentedControl } from "@/components/ui-lab/components/segmented-control/SegmentedControl";
import { DIALECT_LABEL, UI_DIALECTS, type Dialect } from "@/lib/content/types";
import type { EngineStatus } from "./useEngine";

const STATUS_LABEL: Record<EngineStatus["state"], string> = { loading: "엔진 준비 중", ready: "준비됨", error: "연결 실패" };

/** 방언 선택(PostgreSQL·BigQuery). status 를 주면 옆에 엔진 상태를 함께 그린다. */
export function DialectSelector({ value, onChange, status, className = "" }: { value: Dialect; onChange: (d: Dialect) => void; status?: EngineStatus; className?: string }) {
  const dot = status?.state === "ready" ? "bg-pass" : status?.state === "error" ? "bg-fail" : "bg-warn motion-safe:animate-pulse";
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      <SegmentedControl<Dialect> label="SQL 방언" size="sm" value={value} onChange={onChange} options={UI_DIALECTS.map((d) => ({ value: d, label: DIALECT_LABEL[d] }))} />
      {status && <EngineStatusLabel status={status} dot={dot} />}
    </div>
  );
}

export function EngineStatusLabel({ status, dot }: { status: EngineStatus; dot?: string }) {
  const d = dot ?? (status.state === "ready" ? "bg-pass" : status.state === "error" ? "bg-fail" : "bg-warn motion-safe:animate-pulse");
  return (
    <span className="flex items-center gap-1.5 text-[13px] font-semibold text-muted" title={status.message}>
      <span className={`inline-block h-[7px] w-[7px] rounded-full ${d}`} aria-hidden="true" />
      {STATUS_LABEL[status.state]}
      {status.state === "error" && status.message && <span className="max-w-[18rem] truncate text-fail">{status.message}</span>}
    </span>
  );
}
