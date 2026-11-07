import type { SeleckyFace, SeleckyMotion } from "@/components/selecky/Selecky";
import type { SetCategory } from "@/lib/content/types";

/** 경로 옆 장면 그림. 셀렉이 정지 프레임(동작의 정지 자세 또는 표정) 또는 public/scenes 의 그림 */
export type SceneArt = { kind: "selecky"; motion?: SeleckyMotion; face?: SeleckyFace } | { kind: "image"; src: string };

/**
 * 그림이 준비된 장면. 키는 `<분류>-<세트 순번(1부터)>`, 값은 public 기준 경로(투명 배경 webp).
 * 예: "basics-1": "/scenes/basics-1.webp"
 */
const IMAGES: Partial<Record<`${SetCategory}-${number}`, string>> = {};

const POSES: SceneArt[] = [
  { kind: "selecky", motion: "C2" },
  { kind: "selecky", motion: "C5" },
  { kind: "selecky", motion: "C4" },
  { kind: "selecky", face: "surprise" },
  { kind: "selecky", motion: "C1" },
  { kind: "selecky", face: "joy" },
];

/**
 * 세트 장면. 그림이 있으면 그림, 없으면 셀렉이 자세를 돌려 쓴다.
 *
 * Args:
 *   category: 세트 분류.
 *   index: 분류 안 세트 순번(0부터).
 */
export const sceneFor = (category: SetCategory, index: number): SceneArt => {
  const src = IMAGES[`${category}-${index + 1}`];
  return src ? { kind: "image", src } : POSES[index % POSES.length];
};
