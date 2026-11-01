"use client";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** 진행 중. 폭을 유지한 채 스피너를 보이고 클릭을 막는다(`aria-disabled`라 포커스는 유지, 스크린리더에 "처리 중" 안내) */
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  fullWidth?: boolean;
}

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-accent text-white hover:bg-accent/85",
  secondary: "bg-fg/10 text-fg hover:bg-fg/15",
  ghost: "bg-transparent text-fg/80 hover:bg-fg/10 hover:text-fg",
  danger: "bg-red-500/90 text-white hover:bg-red-500",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 after:absolute after:inset-x-0 after:-inset-y-1 after:content-[''] rounded-lg px-3 text-[13px]",
  md: "h-10 gap-2 rounded-xl px-4 text-sm",
  lg: "h-12 gap-2 rounded-xl px-5 text-[15px]",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  leadingIcon,
  trailingIcon,
  fullWidth = false,
  disabled,
  type = "button",
  className = "",
  children,
  onClick,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      aria-disabled={loading || undefined}
      aria-busy={loading || undefined}
      onClick={loading ? (e) => e.preventDefault() : onClick}
      className={`relative inline-flex shrink-0 items-center justify-center font-semibold whitespace-nowrap transition-[background-color,color,transform] duration-150 select-none active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100 aria-disabled:cursor-progress aria-disabled:active:scale-100 motion-reduce:transition-none motion-reduce:active:scale-100 ${VARIANT[variant]} ${SIZE[size]} ${fullWidth ? "w-full" : ""} ${className}`}
      {...rest}
    >
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
          <span className="h-4 w-4 motion-safe:animate-spin rounded-full border-2 border-current border-t-transparent" />
        </span>
      )}
      {loading && <span className="sr-only">처리 중</span>}
      <span className={`inline-flex items-center gap-[inherit] ${loading ? "invisible" : ""}`}>
        {leadingIcon}
        {children}
        {trailingIcon}
      </span>
    </button>
  );
}
