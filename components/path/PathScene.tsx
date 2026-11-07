"use client";
import Image from "next/image";
import { useMemo } from "react";
import { getRuntime } from "@/components/selecky/runtime";
import { SeleckyStyle } from "@/components/selecky/SeleckyStyle";
import type { SceneArt } from "./scenes";

/** 셀렉이 정지 프레임. 재생하지 않는다(스크롤 화면에 여러 개 두므로 움직이는 루프를 만들지 않는다) */
function SeleckyStill({ art }: { art: Extract<SceneArt, { kind: "selecky" }> }) {
  const html = useMemo(() => {
    const rt = getRuntime();
    const face = art.face ?? "default";
    return art.motion ? rt.markupFor(art.motion) : rt.markup({ state: rt.restState(face), faces: [face] });
  }, [art.motion, art.face]);
  return (
    <>
      <SeleckyStyle />
      <span className="selecky size-full" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: html }} />
    </>
  );
}

/**
 * 경로 옆 장식 장면. 기준 노드를 지났으면 컬러, 아니면 흑백(밝음은 옅게, 어두움은 배경 쪽으로 눌러).
 *
 * Args:
 *   art: 장면 그림.
 *   colored: 컬러로 보일지.
 *   side: 경로 기준 왼쪽 -1, 오른쪽 1.
 */
export function PathScene({ art, colored, side }: { art: SceneArt; colored: boolean; side: -1 | 1 }) {
  return (
    <span
      aria-hidden="true"
      data-colored={colored || undefined}
      className={`pointer-events-none absolute top-1/2 left-1/2 z-0 size-[112px] -translate-y-1/2 transition-[filter,opacity] duration-700 ease-out select-none motion-reduce:transition-none sm:size-[170px] lg:size-[210px] ${side < 0 ? "-translate-x-[calc(50%+108px)] sm:-translate-x-[calc(50%+190px)] lg:-translate-x-[calc(50%+300px)]" : "translate-x-[calc(-50%+108px)] sm:translate-x-[calc(-50%+190px)] lg:translate-x-[calc(-50%+300px)]"} ${colored ? "" : "opacity-45 grayscale dark:opacity-35 dark:brightness-75"}`}
    >
      {art.kind === "image" ? <Image src={art.src} alt="" fill sizes="210px" className="object-contain" /> : <SeleckyStill art={art} />}
    </span>
  );
}
