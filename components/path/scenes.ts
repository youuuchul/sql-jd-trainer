import type { SeleckyFace, SeleckyMotion } from "@/components/selecky/Selecky";
import type { SetCategory } from "@/lib/content/types";

/** 경로 옆 장면 그림. 셀렉이 정지 프레임(동작의 정지 자세 또는 표정) 또는 public/scenes 의 그림 */
export type SceneArt = { kind: "selecky"; motion?: SeleckyMotion; face?: SeleckyFace } | { kind: "image"; src: string };

/** 분류별 장면 그림(public/scenes, 420px 투명 webp). 세트 순서대로 돌려 쓴다 */
const IMAGES: Partial<Record<SetCategory, string[]>> = {
  basics: ["/scenes/basics-1.webp", "/scenes/basics-2.webp"],
  job: ["/scenes/job-1.webp", "/scenes/job-2.webp"],
  kpi: ["/scenes/dashboard-1.webp", "/scenes/dashboard-2.webp"],
  review: ["/scenes/review-1.webp"],
  archive: ["/scenes/archive-1.webp"],
};

/** 그림이 없는 분류에 쓰는 셀렉이 정지 프레임 */
const POSES: SceneArt[] = [
  { kind: "selecky", motion: "C2" },
  { kind: "selecky", motion: "C5" },
  { kind: "selecky", motion: "C4" },
  { kind: "selecky", face: "surprise" },
  { kind: "selecky", motion: "C1" },
  { kind: "selecky", face: "joy" },
];

/**
 * 세트 장면. 분류 그림이 있으면 세트 순서대로 번갈아, 없으면 셀렉이 자세를 돌려 쓴다.
 *
 * Args:
 *   category: 세트 분류.
 *   index: 분류 안 세트 순번(0부터).
 */
export const sceneFor = (category: SetCategory, index: number): SceneArt => {
  const list = IMAGES[category];
  return list?.length ? { kind: "image", src: list[index % list.length] } : POSES[index % POSES.length];
};
