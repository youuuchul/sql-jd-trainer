import "server-only";
import { neon } from "@neondatabase/serverless";
import { cacheLife, cacheTag } from "next/cache";
import { CardDeckSchema, ProblemSchema, ProblemSetSchema, SchemaDefSchema, SyntaxRefSchema, type CardDeck, type Problem, type ProblemSet, type SchemaDef, type SyntaxRef } from "./types";

/** 콘텐츠는 운영 DB(content_item)에 있다. 게시는 scripts/publish-content.ts, 무효화는 이 태그로 한다 */
export const CONTENT_TAG = "content";

interface Content {
  schemas: SchemaDef[];
  problems: Problem[];
  sets: ProblemSet[];
  decks: CardDeck[];
  syntax: SyntaxRef[];
}

const loadContent = async (): Promise<Content> => {
  "use cache";
  cacheLife("max");
  cacheTag(CONTENT_TAG);
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL 이 없습니다. 콘텐츠 DB 를 연결하세요.");
  const rows = (await neon(url)`SELECT kind, body FROM content_item ORDER BY kind, id`) as { kind: string; body: unknown }[];
  const of = (kind: string) => rows.filter((r) => r.kind === kind).map((r) => r.body);
  return {
    schemas: of("schema").map((b) => SchemaDefSchema.parse(b)),
    problems: of("problem").map((b) => ProblemSchema.parse(b)),
    sets: of("set").map((b) => ProblemSetSchema.parse(b)),
    decks: of("deck")
      .map((b) => CardDeckSchema.parse(b))
      .sort((a, b) => a.order - b.order),
    syntax: of("syntax").map((b) => SyntaxRefSchema.parse(b)),
  };
};

export const getSchema = async (id: string): Promise<SchemaDef | undefined> => (await loadContent()).schemas.find((s) => s.id === id);
export const getProblem = async (id: string): Promise<Problem | undefined> => (await loadContent()).problems.find((p) => p.id === id);
export const getSet = async (id: string): Promise<ProblemSet | undefined> => (await loadContent()).sets.find((s) => s.id === id);
export const listSets = async (): Promise<ProblemSet[]> => (await loadContent()).sets;
export const listProblems = async (): Promise<Problem[]> => (await loadContent()).problems;
export const listDecks = async (): Promise<CardDeck[]> => (await loadContent()).decks;
export const listSyntax = async (): Promise<SyntaxRef[]> => (await loadContent()).syntax;
export const listSchemas = async (): Promise<SchemaDef[]> => (await loadContent()).schemas;
export const setProblems = async (set: ProblemSet): Promise<Problem[]> => {
  const { problems } = await loadContent();
  return set.problems.map((id) => {
    const p = problems.find((x) => x.id === id);
    if (!p) throw new Error(`unknown problem ${id}`);
    return p;
  });
};
