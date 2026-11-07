import type { SetCategory } from "@/lib/content/types";

/** 분류 색 범위 클래스. hq-catfill·hq-catink·hq-cattint·hq-node 와 같이 쓴다 */
export const CAT_CLASS: Record<SetCategory, string> = {
  basics: "cat-basics",
  job: "cat-job",
  kpi: "cat-kpi",
  review: "cat-review",
  archive: "cat-archive",
};

/** 화면에 쓰는 짧은 분류 이름(칩·노드 위 라벨) */
export const CAT_SHORT: Record<SetCategory, string> = {
  basics: "기초",
  job: "직무",
  kpi: "파이프라인",
  review: "쿼리 리뷰",
  archive: "비공개",
};
