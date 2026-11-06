import type { ProblemFormat } from "@/lib/content/types";

/** 시안 아이콘 세트(24 격자, 선 1.85). 경로는 시안 index.html 의 symbol 을 그대로 옮겼다 */
const PATHS = {
  today: (
    <>
      <rect x="4" y="6.5" width="12.5" height="14.5" rx="2.6" />
      <path d="M8 3.5h9.4A2.6 2.6 0 0 1 20 6.1v11.4" />
    </>
  ),
  practice: (
    <>
      <circle cx="6" cy="18" r="2.4" />
      <circle cx="18" cy="6" r="2.4" />
      <path d="M8.4 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.6" />
    </>
  ),
  jd: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2.6" />
      <path d="M9 7V5.6A1.6 1.6 0 0 1 10.6 4h2.8A1.6 1.6 0 0 1 15 5.6V7M3 12.5h18M10.5 12.5v1.6h3v-1.6" />
    </>
  ),
  flame: <path d="M12 21.2c-4 0-6.8-2.7-6.8-6.4 0-3.3 2.2-5.3 3.8-7.3.3 1.7 1.1 2.9 2.4 3.6.4-3.5 1.7-6.3 4-8.3.4 3 1.6 4.6 3 6.3 1.1 1.4 1.9 3.1 1.9 5.4 0 3.9-3.3 6.7-8.3 6.7Z" />,
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </>
  ),
  x: <path d="M6 6l12 12M18 6 6 18" />,
  bulb: (
    <>
      <path d="M9.2 18h5.6M10.3 21h3.4" />
      <path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.3 1 2.2h5.2c0-.9.4-1.7 1-2.2A6 6 0 0 0 12 3Z" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2.6" />
      <path d="M8.2 10.5V8a3.8 3.8 0 0 1 7.6 0v2.5" />
    </>
  ),
  write: (
    <>
      <path d="M4.5 19.5h3.8L19 8.8a2.7 2.7 0 0 0-3.8-3.8L4.5 15.7v3.8Z" />
      <path d="m13.6 6.6 3.8 3.8" />
    </>
  ),
  fix: <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9l-3.8 3.8Z" />,
  mcq: (
    <>
      <circle cx="6.5" cy="7" r="2.3" />
      <circle cx="6.5" cy="17" r="2.3" />
      <path d="M11.5 7H20M11.5 17H20" />
    </>
  ),
  predict: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.6" />
      <path d="M3.5 9.5h17M10 9.5v10" />
      <path d="M14 14.5h3" />
    </>
  ),
  spot: (
    <>
      <circle cx="10.5" cy="10.5" r="6.2" />
      <path d="m20 20-5-5M8 10.5h5" />
    </>
  ),
  review: (
    <>
      <path d="M4 6h11M4 12h7M4 18h11" />
      <path d="m14.5 13.5 2.6 2.6L21 11.5" />
    </>
  ),
  play: <path d="M8 5.8v12.4a.8.8 0 0 0 1.2.7l10-6.2a.8.8 0 0 0 0-1.4l-10-6.2a.8.8 0 0 0-1.2.7Z" />,
  db: (
    <>
      <ellipse cx="12" cy="6" rx="7" ry="2.8" />
      <path d="M5 6v12c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8V6" />
      <path d="M5 12c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8" />
    </>
  ),
  back: <path d="M15 5 8 12l7 7" />,
  timer: (
    <>
      <circle cx="12" cy="13.5" r="7" />
      <path d="M12 10v3.6l2.3 1.6M9.8 3h4.4" />
    </>
  ),
  xcircle: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m9 9 6 6M15 9l-6 6" />
    </>
  ),
  ccircle: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.3 2.8 2.8L16.2 9.5" />
    </>
  ),
  clock: (
    <>
      <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
      <path d="M4.5 4.5v3.2h3.2M12 8v4l2.6 1.6" />
    </>
  ),
  ext: (
    <>
      <path d="M14 4h6v6M20 4l-8.5 8.5" />
      <path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
    </>
  ),
  link: (
    <>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </>
  ),
  paste: (
    <>
      <rect x="5" y="4.5" width="14" height="16.5" rx="2.6" />
      <path d="M9 4.5V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v.5M9 11h6M9 15h4" />
    </>
  ),
} as const;

export type IconName = keyof typeof PATHS;

/** 문제 형식별 노드·카드 아이콘 */
export const FORMAT_ICON: Record<ProblemFormat, IconName> = {
  write: "write",
  fix: "fix",
  mcq: "mcq",
  predict: "predict",
  spot: "spot",
  review: "review",
};

export interface IconProps {
  name: IconName;
  /** px. 기본 20 */
  size?: number;
  /** 선 굵기. 기본 1.85 */
  strokeWidth?: number;
  /** 면 채움(불꽃·실행 등) */
  filled?: boolean;
  className?: string;
  /** 주면 role="img" 로 읽히고, 없으면 장식으로 숨긴다 */
  label?: string;
}

/**
 * 시안 선 아이콘.
 *
 * Args:
 *   name: 아이콘 이름.
 *   size: 한 변 px.
 *   filled: true 면 currentColor 로 채운다.
 *   label: 접근성 이름. 없으면 aria-hidden.
 */
export function Icon({ name, size = 20, strokeWidth = 1.85, filled = false, className = "", label }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={filled ? 1 : strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 overflow-visible ${className}`}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      {PATHS[name]}
    </svg>
  );
}
