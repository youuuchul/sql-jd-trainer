"use client";
import { useId, useRef, useState, type KeyboardEvent } from "react";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value?: T;
  defaultValue?: T;
  onChange?: (value: T) => void;
  /** 그룹의 접근성 이름 */
  label: string;
  size?: "sm" | "md";
  disabled?: boolean;
  className?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  defaultValue,
  onChange,
  label,
  size = "md",
  disabled = false,
  className = "",
}: SegmentedControlProps<T>) {
  const name = useId();
  const [inner, setInner] = useState<T | undefined>(defaultValue ?? options[0]?.value);
  const current = value ?? inner;
  const index = Math.max(
    options.findIndex((o) => o.value === current),
    0,
  );
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const select = (i: number) => {
    const next = options[i];
    if (!next || disabled) return;
    if (value === undefined) setInner(next.value);
    if (next.value !== current) onChange?.(next.value);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const n = options.length;
    const map: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    let next: number | undefined;
    if (e.key in map) next = (index + map[e.key] + n) % n;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = n - 1;
    if (next === undefined) return;
    e.preventDefault();
    select(next);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-disabled={disabled || undefined}
      onKeyDown={onKeyDown}
      className={`relative grid rounded-xl bg-fg/10 p-1 ${disabled ? "opacity-50" : ""} ${className}`}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden="true"
        className="absolute top-1 bottom-1 left-1 rounded-lg bg-surface shadow-sm ring-1 ring-white/5 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none"
        style={{ width: `calc((100% - 0.5rem) / ${options.length})`, transform: `translateX(${index * 100}%)` }}
      />
      {options.map((o, i) => {
        const selected = i === index;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            name={name}
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            disabled={disabled}
            onClick={() => select(i)}
            className={`relative z-10 rounded-lg font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent disabled:cursor-not-allowed ${
              size === "sm" ? "h-7 px-2.5 text-[13px] after:absolute after:inset-x-0 after:-inset-y-[6px] after:content-['']" : "h-10 px-3 text-sm"
            } ${selected ? "text-fg" : "text-muted hover:text-fg/80"}`}
          >
            <span className="block truncate">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
