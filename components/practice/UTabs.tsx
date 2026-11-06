"use client";
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export interface UTabItem {
  value: string;
  label: ReactNode;
  content: ReactNode;
  /** 라벨 옆 점. fail 은 빨강 */
  pip?: "fail" | "pass" | null;
  /** 탭 목록에는 올리지 않고 패널만 둔다(다른 버튼으로 여는 칸) */
  hidden?: boolean;
}

export interface UTabsProps {
  items: UTabItem[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** 탭 목록의 접근성 이름 */
  label: string;
  /** sm 은 오른쪽 칸 안 작은 탭 */
  size?: "md" | "sm";
  className?: string;
  listClassName?: string;
  panelClassName?: string;
  /** 탭 목록 위에 같이 묶어 그릴 머리(고정 막대에 제목과 탭을 함께 둘 때) */
  header?: ReactNode;
  headerClassName?: string;
  /** seg 는 알약 토글(시안 .seg) */
  variant?: "underline" | "seg";
}

/** 시안 .utabs: 밑줄 탭. 비활성 패널도 마운트해 둔다(입력 상태 유지). */
export function UTabs({ items, value, defaultValue, onChange, label, size = "md", className = "", listClassName = "", panelClassName = "", header, headerClassName = "", variant = "underline" }: UTabsProps) {
  const id = useId();
  const [inner, setInner] = useState(defaultValue ?? items[0]?.value);
  const shown = items.filter((t) => !t.hidden);
  const current = value ?? inner;
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const select = (v: string) => {
    if (value === undefined) setInner(v);
    if (v !== current) onChange?.(v);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const pos = shown.findIndex((t) => t.value === current);
    let next: number | undefined;
    if (e.key === "ArrowRight") next = (pos + 1) % shown.length;
    else if (e.key === "ArrowLeft") next = (pos - 1 + shown.length) % shown.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = shown.length - 1;
    if (next === undefined) return;
    e.preventDefault();
    select(shown[next].value);
    refs.current[next]?.focus();
  };

  const seg = variant === "seg";
  const list = (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={
        seg
          ? `inline-flex gap-0.5 rounded-[13px] bg-surface-2 p-1 ring-1 ring-line ring-inset ${listClassName}`
          : `flex overflow-x-auto border-b border-line ${size === "sm" ? "gap-[18px]" : "gap-[22px]"} ${listClassName}`
      }
    >
      {shown.map((t, i) => {
        const selected = t.value === current;
        return (
          <button
            key={t.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            id={`${id}-tab-${t.value}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`${id}-panel-${t.value}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => select(t.value)}
            className={
              seg
                ? `flex h-8 shrink-0 items-center gap-1.5 rounded-[9px] px-3.5 text-[13.5px] font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-accent ${selected ? "bg-surface text-fg shadow-[0_1px_2px_rgb(0_0_0/0.08),inset_0_0_0_1px_var(--color-line-2)] dark:bg-surface-3 dark:shadow-none" : "text-muted hover:text-fg-2"}`
                : `relative flex shrink-0 items-center gap-1.5 font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent ${size === "sm" ? "h-[38px] text-[13.5px]" : "h-[42px] text-[14.5px]"} ${selected ? "text-fg" : "text-muted hover:text-fg-2"}`
            }
          >
            {t.label}
            {t.pip && <span aria-hidden="true" className={`inline-block h-[7px] w-[7px] rounded-full ${t.pip === "fail" ? "bg-fail" : "bg-pass"}`} />}
            {!seg && selected && <span aria-hidden="true" className="absolute inset-x-0 -bottom-px h-[3px] rounded-sm bg-fg" />}
          </button>
        );
      })}
    </div>
  );
  return (
    <div className={className}>
      {header ? (
        <div className={headerClassName}>
          {header}
          {list}
        </div>
      ) : (
        list
      )}
      {items.map((t) => (
        <div key={t.value} id={`${id}-panel-${t.value}`} role="tabpanel" aria-labelledby={`${id}-tab-${t.value}`} hidden={t.value !== current} className={panelClassName}>
          {t.content}
        </div>
      ))}
    </div>
  );
}
