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
  accent: "bg-accent/15 text-accent",
  success: "bg-emerald-400/15 text-emerald-300",
  warning: "bg-amber-400/15 text-amber-300",
  danger: "bg-red-400/15 text-red-300",
};

const SOLID: Record<BadgeTone, string> = {
  neutral: "bg-fg text-bg",
  accent: "bg-accent text-white",
  success: "bg-emerald-500 text-white",
  warning: "bg-amber-400 text-black",
  danger: "bg-red-500 text-white",
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
