import { SeleckyStyle } from "./SeleckyStyle";
import { ICON_MARKUP } from "./runtime";

export interface SeleckyMarkProps {
  /** 한 변 px (기본 28). */
  size?: number;
  className?: string;
}

/** 사이드바 로고용 정지 얼굴 마크(앱 아이콘과 같은 그림). */
export function SeleckyMark({ size = 28, className }: SeleckyMarkProps) {
  return (
    <>
      <SeleckyStyle />
      <span
        className={className ? `selecky selecky-mark ${className}` : "selecky selecky-mark"}
        style={{ width: size, height: size }}
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: ICON_MARKUP }}
      />
    </>
  );
}
