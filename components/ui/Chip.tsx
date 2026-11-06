import type { ReactNode } from "react";

export type ChipTone = "neutral" | "accent" | "pass" | "fail" | "warn" | "note" | "flame" | "line";

/**
 * 둥근 칩(상태·태그·연속 일수).
 *
 * Args:
 *   tone: 색. neutral 은 면 색.
 *   size: md 26px·sm 22px.
 */
export function Chip({ tone = "neutral", size = "md", className = "", children }: { tone?: ChipTone; size?: "md" | "sm"; className?: string; children: ReactNode }) {
  return <span className={`hq-chip ${tone === "neutral" ? "" : tone} ${size === "sm" ? "sm" : ""} ${className}`}>{children}</span>;
}
