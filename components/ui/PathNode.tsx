import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import type { SetCategory } from "@/lib/content/types";
import type { NodeState } from "@/lib/path";
import { CAT_CLASS } from "./category";
import { Glyph, hasGlyph, Icon, type IconName } from "./icons";

const STATE_LABEL: Record<NodeState, string> = { done: "완료", cur: "지금 권장", todo: "할 일", lock: "잠김" };

/**
 * 진행 경로 노드(완료·현재·할 일·잠김). 가로로 넓적한 동전 모양이고 done 은 체크, lock 은 자물쇠, 나머지는 형식 글리프를 그린다.
 *
 * Args:
 *   state: 노드 상태.
 *   category: 분류 색.
 *   icon: 할 일·현재일 때 아이콘(보통 FORMAT_ICON[format]).
 *   size: 높이 px. 폭은 1.15배. 기본 64.
 *   href: 주면 링크. lock 이어도 링크는 둔다(잠금 화면으로 이동).
 *   label: 접근성 이름(문제 제목 등). 상태가 뒤에 붙는다.
 *   bubble: cur 노드 위 말풍선 글자(예: 이어서·시작).
 *   children: icon 대신 그릴 내용(세트 번호 등).
 */
export function PathNode({ state, category, icon = "write", size = 64, href, label, bubble, className = "", children }: { state: NodeState; category: SetCategory; icon?: IconName; size?: number; href?: string; label?: string; bubble?: string; className?: string; children?: ReactNode }) {
  const glyphName: IconName = state === "done" ? "check" : state === "lock" ? "lock" : icon;
  const px = Math.round(size * 0.46);
  const glyph = children ?? (hasGlyph(glyphName) ? <Glyph name={glyphName} size={px} /> : <Icon name={glyphName} size={px} strokeWidth={2.6} />);
  const style = { "--ns": `${size}px` } as CSSProperties;
  const cls = `hq-node ${state} ${CAT_CLASS[category]} ${className}`;
  const name = label ? `${label}, ${STATE_LABEL[state]}` : STATE_LABEL[state];
  const tip = bubble && state === "cur" ? (
    <span className="hq-bubble" aria-hidden="true">
      {bubble}
    </span>
  ) : null;
  if (href)
    return (
      <Link href={href} className={cls} style={style} aria-label={name} title={label} aria-current={state === "cur" ? "step" : undefined}>
        {tip}
        {glyph}
      </Link>
    );
  return (
    <span className={cls} style={style} role="img" aria-label={name}>
      {tip}
      {glyph}
    </span>
  );
}
