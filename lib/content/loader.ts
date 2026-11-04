import "server-only";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { CardDeckSchema, ProblemSchema, ProblemSetSchema, SchemaDefSchema, type CardDeck, type Problem, type ProblemSet, type SchemaDef } from "./types";

const ROOT = path.join(process.cwd(), "content");

const readJson = (file: string): unknown => JSON.parse(readFileSync(file, "utf-8"));

const listJson = (dir: string): string[] => {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listJson(full));
    else if (entry.name.endsWith(".json")) out.push(full);
  }
  return out.sort();
};

let cache: { schemas: Map<string, SchemaDef>; problems: Map<string, Problem>; sets: Map<string, ProblemSet>; decks: CardDeck[] } | null = null;

const load = () => {
  if (cache) return cache;
  const schemas = new Map<string, SchemaDef>();
  for (const file of listJson(path.join(ROOT, "schemas"))) {
    const def = SchemaDefSchema.parse(readJson(file));
    schemas.set(def.id, def);
  }
  const problems = new Map<string, Problem>();
  for (const file of listJson(path.join(ROOT, "problems"))) {
    const p = ProblemSchema.parse(readJson(file));
    if (!schemas.has(p.schema)) throw new Error(`${file}: unknown schema ${p.schema}`);
    if (p.format !== "mcq" && !p.expected?.rows.length) throw new Error(`${file}: expected 결과가 없습니다. scripts/build-expected.ts 를 먼저 실행하세요.`);
    if (p.format === "predict" && !p.input?.rows.length) throw new Error(`${file}: predict 문제는 input 표가 필요합니다. scripts/build-expected.ts 를 먼저 실행하세요.`);
    if (p.format === "spot" && !p.spot?.anomalyRows.length) throw new Error(`${file}: spot 문제는 spot.anomalyRows 가 필요합니다. scripts/build-expected.ts 를 먼저 실행하세요.`);
    problems.set(p.id, p);
  }
  const sets = new Map<string, ProblemSet>();
  for (const file of listJson(path.join(ROOT, "sets"))) {
    const s = ProblemSetSchema.parse(readJson(file));
    for (const id of s.problems) {
      if (!problems.has(id)) throw new Error(`${file}: unknown problem ${id}`);
    }
    sets.set(s.id, s);
  }
  const decks = listJson(path.join(ROOT, "cards"))
    .map((file) => {
      const deck = CardDeckSchema.parse(readJson(file));
      for (const c of deck.cards) if (!c.result) throw new Error(`${file}: 카드 ${c.id} 의 result 가 없습니다. scripts/build-cards.ts 를 먼저 실행하세요.`);
      return deck;
    })
    .sort((a, b) => a.order - b.order);
  cache = { schemas, problems, sets, decks };
  return cache;
};

export const getSchema = (id: string): SchemaDef | undefined => load().schemas.get(id);
export const getProblem = (id: string): Problem | undefined => load().problems.get(id);
export const getSet = (id: string): ProblemSet | undefined => load().sets.get(id);
export const listSets = (): ProblemSet[] => [...load().sets.values()];
export const listProblems = (): Problem[] => [...load().problems.values()];
export const setProblems = (set: ProblemSet): Problem[] =>
  set.problems.map((id) => {
    const p = load().problems.get(id);
    if (!p) throw new Error(`unknown problem ${id}`);
    return p;
  });
export const listDecks = (): CardDeck[] => load().decks;
