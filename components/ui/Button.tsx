import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonTone = "primary" | "ghost" | "pass" | "fail" | "off" | "inverse";
export type ButtonSize = "md" | "sm" | "xs";

interface Common {
  tone?: ButtonTone;
  size?: ButtonSize;
  /** 폭 가득 */
  full?: boolean;
  className?: string;
  children: ReactNode;
}

export type ButtonProps = Common & ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };
export type ButtonLinkProps = Common & { href: string; target?: string; rel?: string; "aria-label"?: string };

const cls = ({ tone = "primary", size = "md", full = false, className = "" }: Common) =>
  `hq-btn ${tone === "primary" ? "" : tone} ${size === "md" ? "" : size} ${full ? "full" : ""} ${className}`;

/**
 * 아래 그림자가 눌리는 버튼. href 를 주면 Link 로 그린다.
 *
 * Args:
 *   tone: primary(주색)·ghost(면)·pass·fail·off(비활성 모양)·inverse(색 면 위 흰 버튼).
 *   size: md 52px·sm 40px·xs 32px.
 *   full: 폭 가득.
 */
export function Button(props: ButtonProps | ButtonLinkProps) {
  if (props.href !== undefined) {
    const { href, target, rel, children, "aria-label": ariaLabel } = props;
    return (
      <Link href={href} target={target} rel={rel} aria-label={ariaLabel} className={cls(props)}>
        {children}
      </Link>
    );
  }
  const { tone, size, full, className, children, type = "button", ...rest } = props;
  return (
    <button type={type} className={cls({ tone, size, full, className, children })} {...rest}>
      {children}
    </button>
  );
}
