import "server-only";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith(".json") ? [path.join(dir, e.name)] : []))
    .sort();

/** 게시 전 확인용. 로컬 content/ 를 content_item 행과 같은 모양으로 읽는다 */
export const readLocalContent = (): { kind: string; body: unknown }[] => {
  const root = path.join(process.cwd(), "content");
  const read = (dir: string) => walk(path.join(root, dir)).map((f) => JSON.parse(readFileSync(f, "utf-8")) as unknown);
  return [
    ...read("schemas").map((body) => ({ kind: "schema", body })),
    ...read("problems").map((body) => ({ kind: "problem", body })),
    ...read("sets").map((body) => ({ kind: "set", body })),
    ...read("cards").map((body) => ({ kind: "deck", body })),
    ...read("syntax").flatMap((list) => (list as unknown[]).map((body) => ({ kind: "syntax", body }))),
    ...read("skills").flatMap((list) => (list as unknown[]).map((body) => ({ kind: "skill", body }))),
  ];
};
