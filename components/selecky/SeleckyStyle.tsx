import { TOKENS } from "./runtime";

const vars = TOKENS.map(([name, value]) => `--${name}:${value}`).join(";");
const fills = TOKENS.map(([name]) => `.selecky .${name}{fill:var(--${name})}`).join("");

const CSS =
  `.selecky{display:inline-block;flex:none;${vars};--sl-shadow:rgba(60,80,170,.3)}` +
  `@media (prefers-color-scheme:dark){.selecky{--sl-shadow:rgba(255,255,255,.2)}}` +
  `${fills}.selecky .sl-arm{fill:var(--sl-arm)}.selecky .sl-shadow{fill:var(--sl-shadow)}` +
  `.selecky .sl-line{fill:none;stroke:var(--sl-ink);stroke-linecap:round;stroke-linejoin:round}` +
  `.selecky .sl-edge{fill:var(--sl-eye);stroke:var(--sl-ink);stroke-linejoin:round}` +
  `.selecky .slk{display:block;width:100%;height:100%;overflow:visible}` +
  `.selecky-mark{overflow:hidden;border-radius:22%}.selecky-mark svg{display:block;width:100%;height:100%}`;

export function SeleckyStyle() {
  return (
    <style href="selecky" precedence="selecky">
      {CSS}
    </style>
  );
}
