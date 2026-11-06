import type { ReactNode } from "react";

export type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";

export interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  /** soft: 옅은 바탕, solid: 채운 바탕 */
  appearance?: "soft" | "solid";
  size?: "sm" | "md";
  /** 앞에 상태 점 */
  dot?: boolean;
  className?: string;
}

const SOFT: Record<BadgeTone, string> = {
  neutral: "bg-fg/10 text-fg/80",
  accent: "bg-accent-soft text-accent-ink",
  success: "bg-pass-soft text-pass-ink",
  warning: "bg-warn-soft text-warn",
  danger: "bg-fail-soft text-fail-ink",
};

const SOLID: Record<BadgeTone, string> = {
  neutral: "bg-fg text-bg",
  accent: "bg-accent text-white",
  success: "bg-pass text-white",
  warning: "bg-warn text-white dark:text-black",
  danger: "bg-fail text-white",
};

export function Badge({ children, tone = "neutral", appearance = "soft", size = "md", dot = false, className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full font-semibold whitespace-nowrap ${
        size === "sm" ? "h-5 px-2 text-[11px]" : "h-6 px-2.5 text-xs"
      } ${appearance === "solid" ? SOLID[tone] : SOFT[tone]} ${className}`}
    >
      {dot && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
