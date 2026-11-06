"use client";

import { useImperativeHandle, useLayoutEffect, useMemo, useRef, type Ref } from "react";
import { SeleckyStyle } from "./SeleckyStyle";
import { SLOT_SIZES, getRuntime, type SeleckyFace, type SeleckyMotion } from "./runtime";

export type { SeleckyFace, SeleckyMotion };

export interface SeleckyHandle {
  /** 동작을 처음부터 다시 재생한다. 정지 프레임이면 아무 일도 하지 않는다. */
  replay: () => void;
}

export interface SeleckyProps {
  /** 동작 코드. 없으면 정지 프레임. */
  motion?: SeleckyMotion;
  /** 정지 프레임의 표정(동작이 있으면 동작의 표정을 쓴다). */
  face?: SeleckyFace;
  /** 한 변 px. 없으면 동작별 기본 크기(C1 56, C2·C3 88, C4 160, C5 120), 정지는 96. */
  size?: number;
  className?: string;
  ref?: Ref<SeleckyHandle>;
}

/** 셀렉이 캐릭터. 마운트할 때 한 번 재생하고(loop·깜빡임 동작은 계속), 움직임 줄이기 설정이면 정지 프레임만 보여 준다. */
export function Selecky({ motion, face = "default", size, className, ref }: SeleckyProps) {
  const box = useRef<HTMLSpanElement>(null);
  const html = useMemo(() => {
    const rt = getRuntime();
    return motion ? rt.markupFor(motion) : rt.markup({ state: rt.restState(face), faces: [face] });
  }, [motion, face]);

  const start = () => {
    const svg = box.current?.querySelector("svg");
    if (!svg || !motion) return null;
    const rt = getRuntime();
    if (!rt.noMotion()) rt.apply(svg, rt.frameState(motion, 0));
    rt.play(svg, motion);
    return svg;
  };

  useImperativeHandle(ref, () => ({ replay: () => void start() }));

  useLayoutEffect(() => {
    const svg = start();
    return () => {
      if (svg) getRuntime().stop(svg);
    };
    // start 는 motion·html 만 읽는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motion, html]);

  const px = size ?? (motion ? SLOT_SIZES[motion] : 96);
  return (
    <>
      <SeleckyStyle />
      <span
        ref={box}
        className={className ? `selecky ${className}` : "selecky"}
        style={{ width: px, height: px }}
        aria-hidden="true"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </>
  );
}
