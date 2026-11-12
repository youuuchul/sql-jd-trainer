import { CAT_CLASS } from "@/components/ui/category";
import type { SetCategory, SkillShelf } from "@/lib/content/types";

/** 선반 색은 분류 색을 빌려 쓴다 */
export const SHELF_CATEGORY: Record<SkillShelf, SetCategory> = {
  pattern: "job",
  function: "review",
  basics: "basics",
};

export const SHELF_CLASS: Record<SkillShelf, string> = {
  pattern: CAT_CLASS[SHELF_CATEGORY.pattern],
  function: CAT_CLASS[SHELF_CATEGORY.function],
  basics: CAT_CLASS[SHELF_CATEGORY.basics],
};
