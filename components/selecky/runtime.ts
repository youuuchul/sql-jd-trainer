import shapes from "./selecky-shapes.json";
import rigJson from "./rig.json";
import { RUNTIME_SRC } from "./runtime-source.generated";

export type SeleckyMotion = "C1" | "C2" | "C3" | "C4" | "C5";
export type SeleckyFace = "default" | "joy" | "sad" | "think" | "surprise" | "sleepy";

interface Motion {
  dur: number;
  loop: boolean;
  blink: boolean;
  flame: boolean;
}

export interface SelRuntime {
  rig: { motions: Record<string, Motion> };
  restState: (face?: string) => unknown;
  frameState: (code: string, t: number) => unknown;
  markup: (o: { state?: unknown; faces?: string[]; vb?: string }) => string;
  markupFor: (code: string, extra?: Record<string, unknown>) => string;
  apply: (svg: SVGSVGElement, state: unknown) => void;
  play: (svg: SVGSVGElement, code: string) => void;
  stop: (svg: SVGSVGElement) => void;
  noMotion: () => boolean;
}

export const SLOT_SIZES = shapes.sizes as Record<string, number>;
export const ICON_MARKUP = shapes.icon as string;
export const TOKENS = shapes.tokens as [string, string][];

/** 서버(Node)에는 DOMMatrix 가 없어 같은 계산을 하는 작은 행렬로 대신한다. 브라우저에서는 원본과 같게 기본 DOMMatrix 를 쓴다. */
class Mat {
  constructor(
    public a = 1,
    public b = 0,
    public c = 0,
    public d = 1,
    public e = 0,
    public f = 0,
  ) {}
  private mul(a2: number, b2: number, c2: number, d2: number, e2: number, f2: number): Mat {
    const { a, b, c, d, e, f } = this;
    return new Mat(a * a2 + c * b2, b * a2 + d * b2, a * c2 + c * d2, b * c2 + d * d2, a * e2 + c * f2 + e, b * e2 + d * f2 + f);
  }
  translate(tx: number, ty = 0): Mat {
    return this.mul(1, 0, 0, 1, tx, ty);
  }
  scale(sx: number, sy = sx): Mat {
    return this.mul(sx, 0, 0, sy, 0, 0);
  }
  rotate(deg: number): Mat {
    const r = (deg * Math.PI) / 180;
    const cos = Math.cos(r);
    const sin = Math.sin(r);
    return this.mul(cos, sin, -sin, cos, 0, 0);
  }
}

let cached: SelRuntime | null = null;

/** 원본 런타임(selecky-runtime.js)을 그대로 실행해 SelRT 를 만든다. */
export function getRuntime(): SelRuntime {
  if (!cached) {
    const factory = new Function("DOMMatrix", `${RUNTIME_SRC}\nreturn SelRT;`)(typeof DOMMatrix === "undefined" ? Mat : DOMMatrix) as (d: unknown) => SelRuntime;
    cached = factory({ ...shapes, rig: rigJson });
  }
  return cached;
}
