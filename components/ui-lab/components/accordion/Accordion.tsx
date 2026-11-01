"use client";
import { useId, useState, type ReactNode } from "react";

export interface AccordionItem {
  value: string;
  title: ReactNode;
  content: ReactNode;
}

export interface AccordionProps {
  items: AccordionItem[];
  /** single: 하나만 열림, multiple: 여러 개 동시에 */
  type?: "single" | "multiple";
  value?: string[];
  defaultValue?: string[];
  onChange?: (value: string[]) => void;
  className?: string;
}

export function Accordion({ items, type = "single", value, defaultValue = [], onChange, className = "" }: AccordionProps) {
  const id = useId();
  const [inner, setInner] = useState(defaultValue);
  const open = value ?? inner;

  const toggle = (v: string) => {
    const isOpen = open.includes(v);
    const next = isOpen ? open.filter((x) => x !== v) : type === "single" ? [v] : [...open, v];
    if (value === undefined) setInner(next);
    onChange?.(next);
  };

  return (
    <div className={`divide-y divide-line ${className}`}>
      {items.map((item, i) => {
        const isOpen = open.includes(item.value);
        return (
          <div key={item.value}>
            <h3>
              <button
                id={`${id}-h-${i}`}
                type="button"
                aria-expanded={isOpen}
                aria-controls={`${id}-p-${i}`}
                onClick={() => toggle(item.value)}
                className="flex w-full items-center justify-between gap-4 py-3.5 text-left text-sm font-medium text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {item.title}
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className={`h-4 w-4 shrink-0 text-muted transition-transform motion-reduce:transition-none ${isOpen ? "rotate-180 duration-300" : "duration-200"}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
            </h3>
            <div
              id={`${id}-p-${i}`}
              role="region"
              aria-labelledby={`${id}-h-${i}`}
              inert={!isOpen}
              className={`grid transition-[grid-template-rows,opacity] ${isOpen ? "duration-300" : "duration-200"} ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none ${
                isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              }`}
            >
              <div className="overflow-hidden">
                <div className="pb-4 text-sm leading-relaxed text-fg/75">{item.content}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
