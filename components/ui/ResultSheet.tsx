import type { ReactNode } from "react";

/**
 * 아래에서 올라오는 정답·오답 시트. 화면 아래에 고정되고 action 은 폭 가득 버튼 자리다.
 *
 * Args:
 *   tone: pass(초록)·fail(빨강).
 *   action: 시트 맨 아래(보통 <Button full tone="pass">계속</Button>).
 *   scrim: 뒤 화면을 옅게 덮는다.
 *   inline: 고정하지 않고 흐름 안에 둔다(데스크톱 칸 안 등).
 */
export function ResultSheet({ tone, action, scrim = false, inline = false, className = "", children }: { tone: "pass" | "fail"; action?: ReactNode; scrim?: boolean; inline?: boolean; className?: string; children: ReactNode }) {
  const sheet = (
    <section role="status" aria-live="polite" className={`hq-sheet ${tone} ${inline ? "rounded-b-[28px]" : ""} ${className}`}>
      <div className="mx-auto w-full max-w-lg">
        {children}
        {action && <div className="mt-5">{action}</div>}
      </div>
    </section>
  );
  if (inline) return sheet;
  return (
    <>
      {scrim && <div aria-hidden="true" className="fixed inset-0 z-40 bg-bg/30" />}
      <div className="fixed inset-x-0 bottom-0 z-50">{sheet}</div>
    </>
  );
}
