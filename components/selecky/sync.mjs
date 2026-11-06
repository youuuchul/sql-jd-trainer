/* 셀렉이 원본(docs/design/haruquery-v2/character/svg)에서 런타임·리그·도형을 가져온다.
   사용: node components/selecky/sync.mjs <원본 svg 폴더>   (--check 를 붙이면 쓰지 않고 차이만 확인) */
import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const check = args.includes("--check");
const src = resolve(args.find((a) => !a.startsWith("--")) ?? "");
if (!args.find((a) => !a.startsWith("--"))) {
  console.error("원본 svg 폴더 경로가 필요하다");
  process.exit(2);
}

const files = ["selecky-runtime.js", "rig.json"];
let drift = false;
for (const f of files) {
  let same = false;
  try {
    same = readFileSync(join(src, f)).equals(readFileSync(join(here, f)));
  } catch {
    same = false;
  }
  if (!same) drift = true;
  if (!check) copyFileSync(join(src, f), join(here, f));
}

const preview = readFileSync(join(src, "preview.html"), "utf8");
const line = preview.split("\n").find((l) => l.startsWith("const D = "));
if (!line) throw new Error("preview.html 에서 const D 를 찾지 못했다");
const { rig: _rig, ...shapes } = JSON.parse(line.slice("const D = ".length).replace(/;\s*$/, ""));
void _rig;
const shapesJson = JSON.stringify(shapes, null, 1) + "\n";
const runtime = readFileSync(check ? join(here, "selecky-runtime.js") : join(src, "selecky-runtime.js"), "utf8");
const gen =
  "/* sync.mjs 가 만든 파일. 직접 고치지 않는다. */\n" +
  `export const RUNTIME_SRC: string = ${JSON.stringify(runtime)};\n`;

const outputs = [
  ["selecky-shapes.json", shapesJson],
  ["runtime-source.generated.ts", gen],
];
for (const [name, body] of outputs) {
  let cur = "";
  try {
    cur = readFileSync(join(here, name), "utf8");
  } catch {
    cur = "";
  }
  if (cur !== body) drift = true;
  if (!check) writeFileSync(join(here, name), body);
}
console.log(check ? (drift ? "차이 있음" : "일치") : "동기화 완료");
process.exit(check && drift ? 1 : 0);
