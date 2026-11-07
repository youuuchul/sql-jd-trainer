import { CAT_SHORT } from "@/components/ui/category";
import type { SetCategory } from "@/lib/content/types";

/**
 * 세트 제목에서 분류 접두어("기초 4." · "직무 · ")를 뗀다.
 *
 * Args:
 *   title: 세트 제목.
 *   category: 세트 분류.
 *
 * Returns:
 *   kicker: 분류 이름(제목에 번호가 있으면 "기초 4"), name: 접두어를 뗀 이름.
 */
export const splitSetTitle = (title: string, category: SetCategory): { kicker: string; name: string } => {
  const short = CAT_SHORT[category];
  const m = title.match(new RegExp(`^${short}\\s*(?:·|(\\d+)\\.)\\s*`));
  if (!m) return { kicker: short, name: title };
  return { kicker: m[1] ? `${short} ${m[1]}` : short, name: title.slice(m[0].length) };
};
