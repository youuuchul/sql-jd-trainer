import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Problem, ProblemSet, SchemaDef } from "../lib/content/types";

/** 콘텐츠는 저장소에 없고 로컬 content/ 와 운영 DB 에만 있다. 테스트는 실행할 때 로컬 파일에서 읽는다 */
const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith(".json") ? [path.join(dir, e.name)] : []));
const read = <T,>(file: string) => JSON.parse(readFileSync(file, "utf-8")) as T;

export const problems = (): Problem[] => walk("content/problems").map((f) => read<Problem>(f));
export const problem = (id: string): Problem => {
  const p = problems().find((x) => x.id === id);
  if (!p) throw new Error(`로컬 content 에 문제 ${id} 가 없습니다`);
  return p;
};
export const set = (id: string): ProblemSet => read<ProblemSet>(path.join("content/sets", `${id}.json`));
export const lockedSchemaIds = (): Set<string> =>
  new Set(
    walk("content/schemas")
      .map((f) => read<SchemaDef>(f))
      .filter((s) => s.locked)
      .map((s) => s.id),
  );
