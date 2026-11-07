import { Suspense, type ReactNode } from "react";
import { isUnlocked } from "@/lib/unlock/server";
import { UnlockForm } from "./UnlockForm";

async function Gate({ title, children }: { title: string; children: () => ReactNode }) {
  if (!(await isUnlocked())) return <UnlockForm title={title} />;
  return children();
}

export const LOCKED_TITLE = "비공개 세트";

/** 잠긴 스키마의 화면. 잠금이 풀린 요청에서만 render 를 호출하므로 문제 데이터가 정적 셸에 실리지 않는다. */
export function LockGate({ locked, title, render }: { locked: boolean; title: string; render: () => ReactNode }) {
  if (!locked) return render();
  return (
    <Suspense fallback={<div className="flex-1" />}>
      <Gate title={title}>{render}</Gate>
    </Suspense>
  );
}
