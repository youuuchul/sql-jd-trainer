import type { ReactNode } from "react";

/** 노란 설명 카드(정답 뒤 해설, 지표 정의 강조) */
export function Note({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`hq-note ${className}`}>{children}</div>;
}
