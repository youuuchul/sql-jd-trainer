import type { CSSProperties } from "react";
import { BOX_INTERVAL_MIN, intervalLabel, MAX_BOX } from "@/lib/daily/srs";

/**
 * 다음 복습 주기 사다리(5분·1일·3일·7일·14일·30일). 결과 시트 안에서 --ci(시트 글자색)를 쓴다.
 *
 * Args:
 *   box: 이번 풀이 뒤 상자 번호. 이 눈금이 현재, 앞은 지난 단계.
 *   tone: pass 는 초록, fail 은 빨강 채움.
 */
export function ReviewLadder({ box, tone }: { box: number; tone: "pass" | "fail" }) {
  const lad = tone === "fail" ? "var(--color-fail)" : "var(--color-pass)";
  return (
    <ol aria-label="복습 주기" className="relative m-0 grid list-none grid-cols-6 p-0 pt-1" style={{ "--lad": lad } as CSSProperties}>
      <span aria-hidden="true" className="absolute top-[13px] right-[8.33%] left-[8.33%] h-1 rounded-sm bg-[color-mix(in_srgb,var(--ci)_16%,transparent)]" />
      <span aria-hidden="true" className="absolute top-[13px] left-[8.33%] h-1 rounded-sm bg-[var(--lad)]" style={{ width: `${(Math.min(box, MAX_BOX) / MAX_BOX) * 83.33}%` }} />
      {BOX_INTERVAL_MIN.map((_, i) => {
        const now = i === box;
        const past = i < box;
        return (
          <li key={i} aria-current={now ? "step" : undefined} className={`relative z-[1] grid justify-items-center gap-[7px] text-[11.5px] font-bold ${now ? "text-[var(--ci)]" : "text-[color-mix(in_srgb,var(--ci)_55%,transparent)]"}`}>
            <i
              aria-hidden="true"
              className={`rounded-full ${
                now
                  ? "-mt-0.5 h-[22px] w-[22px] bg-[var(--lad)] shadow-[0_0_0_5px_color-mix(in_srgb,var(--lad)_22%,transparent)]"
                  : past
                    ? "mt-0.5 h-3.5 w-3.5 bg-[var(--lad)]"
                    : "mt-0.5 h-3.5 w-3.5 bg-surface shadow-[inset_0_0_0_3px_color-mix(in_srgb,var(--ci)_22%,transparent)]"
              }`}
            />
            {intervalLabel(i)}
          </li>
        );
      })}
    </ol>
  );
}
