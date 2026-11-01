"use client";
import type { CompareResult, Diagnosis } from "@/lib/grading";

export function GradeBanner({ cmp, diagnoses, ms }: { cmp: CompareResult; diagnoses: Diagnosis[]; ms: number }) {
  if (cmp.pass) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-pass/40 bg-pass/10 px-4 py-2.5 text-sm">
        <span className="inline-block h-2 w-2 rounded-full bg-pass" aria-hidden="true" />
        <span className="font-medium text-pass">정답</span>
        <span className="text-muted">기대 결과와 일치합니다. {ms}ms</span>
      </div>
    );
  }
  return (
    <div className="space-y-2 rounded-xl border border-fail/40 bg-fail/10 px-4 py-3 text-sm">
      <div className="flex items-center gap-3">
        <span className="inline-block h-2 w-2 rounded-full bg-fail" aria-hidden="true" />
        <span className="font-medium text-fail">오답</span>
        <span className="text-muted">
          기대 {cmp.expectedRows}행, 결과 {cmp.actualRows}행. {ms}ms
        </span>
      </div>
      <ul className="list-disc space-y-0.5 pl-5 text-[13px] text-fg/85">
        {cmp.mismatches.map((m, i) => (
          <li key={i}>{m.message}</li>
        ))}
      </ul>
      {diagnoses.length > 0 && (
        <ul className="space-y-1.5 border-t border-fail/20 pt-2">
          {diagnoses.map((d, i) => (
            <li key={i} className="text-[13px] leading-relaxed">
              <span className={`mr-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${d.source === "pattern" ? "bg-warn/20 text-warn" : "bg-fg/10 text-fg/80"}`}>{d.label}</span>
              <span className="text-fg/85">{d.explanation}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
