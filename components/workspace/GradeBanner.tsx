"use client";
import { Icon } from "@/components/ui/icons";
import type { CompareResult, Diagnosis } from "@/lib/grading";

/** 오답 원인 라벨 */
export function CauseLabel({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex h-6 shrink-0 items-center rounded-[7px] bg-note px-[9px] text-[12.5px] font-bold whitespace-nowrap text-[#3e3000]">{children}</span>;
}

export function GradeBanner({ cmp, diagnoses, ms }: { cmp: CompareResult; diagnoses: Diagnosis[]; ms: number }) {
  if (cmp.pass) {
    return (
      <div className="rounded-2xl bg-pass-soft px-4 py-3.5 ring-[1.5px] ring-pass/30 ring-inset">
        <div className="flex items-center gap-2 text-sm text-fg-2">
          <Icon name="ccircle" size={20} className="text-pass" />
          <b className="text-[15px] font-extrabold text-pass-ink">정답</b>
          {ms > 0 && <span className="font-mono text-[12.5px]">{ms}ms</span>}
        </div>
        <p className="mt-1.5 text-[13.5px] font-medium text-fg-2">기대 결과와 일치합니다.</p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl bg-fail-soft px-4 py-3.5 ring-[1.5px] ring-fail/30 ring-inset">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-fg-2">
        <Icon name="xcircle" size={20} className="text-fail" />
        <b className="text-[15px] font-extrabold text-fail-ink">오답</b>
        <span className="font-mono text-[12.5px]">
          기대 {cmp.expectedRows}행 · 결과 {cmp.actualRows}행{ms > 0 && ` · ${ms}ms`}
        </span>
      </div>
      {cmp.mismatches.map((m, i) => (
        <p key={i} className="mt-1.5 text-[13.5px] font-medium text-fg-2">
          {m.message}
        </p>
      ))}
      {diagnoses.length > 0 && (
        <ul className="mt-3 space-y-3 border-t border-fail/20 pt-3">
          {diagnoses.map((d, i) => (
            <li key={i} className="text-[13.5px] leading-[1.6] font-medium text-fg-2">
              <CauseLabel>{d.label}</CauseLabel>
              <p className="mt-1.5">{d.explanation}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** 객관식·출력 예측·결과 이상 찾기·쿼리 리뷰의 정답·오답 표시. detail 은 한 줄 요약. */
export function Verdict({ pass, children, action }: { pass: boolean; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-2.5 gap-y-1.5 rounded-2xl px-4 py-3 ring-[1.5px] ring-inset ${pass ? "bg-pass-soft ring-pass/30" : "bg-fail-soft ring-fail/30"}`}>
      <Icon name={pass ? "ccircle" : "xcircle"} size={20} className={pass ? "text-pass" : "text-fail"} />
      <b className={`text-[15px] font-extrabold ${pass ? "text-pass-ink" : "text-fail-ink"}`}>{pass ? "정답" : "오답"}</b>
      {children && <span className="min-w-0 flex-1 text-[13.5px] font-medium text-fg-2">{children}</span>}
      {action}
    </div>
  );
}
