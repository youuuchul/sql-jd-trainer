"use client";
import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { SegmentedControl } from "@/components/ui-lab/components/segmented-control/SegmentedControl";
import { Button } from "@/components/ui/Button";
import { DIALECT_LABEL, UI_DIALECTS } from "@/lib/content/types";
import type { DialectFilter } from "@/lib/daily/srs";
import type { DailySettings } from "@/lib/daily/store";
import { PushToggle } from "@/components/daily/PushToggle";

const GOALS = [5, 10, 20, 30] as const;
const DIALECT_OPTIONS: { value: DialectFilter; label: string }[] = [{ value: "all", label: "전체" }, ...UI_DIALECTS.map((d) => ({ value: d, label: DIALECT_LABEL[d] }))];

/** 하루 목표·방언·알림. 모바일은 아래에서 올라오는 시트, 데스크톱은 가운데 상자 */
export function SettingsSheet({ goal, dialect, onChange, onClose }: { goal: number; dialect: DialectFilter; onChange: (patch: Partial<DailySettings>) => void; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  /** 열려 있는 동안 Tab 이 시트 밖으로 나가지 않는다 */
  const trapTab = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab" || !panel.current) return;
    const items = [...panel.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])')];
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === panel.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center">
      <button type="button" aria-label="닫기" tabIndex={-1} onClick={onClose} className="absolute inset-0 bg-bg/60 backdrop-blur-[2px]" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="설정"
        tabIndex={-1}
        onKeyDown={trapTab}
        className="relative w-full max-w-lg rounded-t-[28px] bg-surface p-5 pb-[calc(20px+env(safe-area-inset-bottom))] shadow-[inset_0_1px_0_var(--color-line)] outline-none lg:max-w-md lg:rounded-[28px] lg:pb-5 lg:shadow-[inset_0_0_0_1px_var(--color-line)]"
      >
        <h2 className="mb-4 text-xl font-extrabold tracking-[-0.03em]">설정</h2>
        <div className="space-y-5">
          <div>
            <p className="mb-2 text-sm font-semibold text-fg-2">하루 목표</p>
            <SegmentedControl label="하루 목표" size="sm" options={GOALS.map((g) => ({ value: String(g), label: `${g}장` }))} value={String(goal)} onChange={(v) => onChange({ goal: Number(v) })} />
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold text-fg-2">방언</p>
            <SegmentedControl label="방언" size="sm" options={DIALECT_OPTIONS} value={dialect} onChange={(v) => onChange({ dialect: v })} />
          </div>
          <PushToggle goal={goal} />
        </div>
        <Button full tone="ghost" size="sm" className="mt-6" onClick={onClose}>
          닫기
        </Button>
      </div>
    </div>
  );
}
