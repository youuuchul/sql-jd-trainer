import type { HTMLAttributes, ReactNode } from "react";

/**
 * 면 카드. 밝음은 선 + 아래 그림자, 어두움은 선만.
 *
 * Args:
 *   flat: 아래 그림자 없이 선만.
 *   as: 그릴 요소. 기본 div.
 */
export function Card({ flat = false, as: Tag = "div", className = "", children, ...rest }: { flat?: boolean; as?: "div" | "section" | "article" | "li"; children: ReactNode } & HTMLAttributes<HTMLElement>) {
  return (
    <Tag className={`hq-card ${flat ? "flat" : ""} ${className}`} {...rest}>
      {children}
    </Tag>
  );
}
