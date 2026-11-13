import "server-only";
import { neon } from "@neondatabase/serverless";
import { cacheLife, cacheTag } from "next/cache";
import { CardDeckSchema, ProblemSchema, ProblemSetSchema, SchemaDefSchema, SkillSchema, SyntaxRefSchema, type CardDeck, type Problem, type ProblemSet, type SchemaDef, type Skill, type SyntaxRef } from "./types";

/** 콘텐츠는 운영 DB(content_item)에 있다. 게시는 scripts/publish-content.ts, 무효화는 이 태그로 한다 */
export const CONTENT_TAG = "content";

type Kind = "schema" | "problem" | "set" | "deck" | "syntax" | "skill";

/** 목록 화면에 필요한 문제 필드. 정답·기대 결과처럼 무거운 본문은 getProblem 으로 한 건씩 읽는다 */
export interface ProblemMeta extends Pick<Problem, "id" | "title" | "schema" | "difficulty" | "format" | "sourceType" | "tags" | "skills"> {
  timeLimitMin: number | null;
  /** 빈칸 채우기로 풀 수 있다 */
  blanks: boolean;
}
/** 시드 데이터를 뺀 스키마 요약 */
export type SchemaMeta = Pick<SchemaDef, "id" | "locked" | "domain">;

/** 개발 모드에서 CONTENT_SOURCE=local 이면 게시 전 로컬 content/ 를 읽는다 */
const fromLocal = () => process.env.NODE_ENV === "development" && process.env.CONTENT_SOURCE === "local";
const db = () => {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL 이 없습니다. 콘텐츠 DB 를 연결하세요.");
  return neon(url);
};
const localBodies = async (kind: Kind) => (await import("./local")).readLocalContent().flatMap((r) => (r.kind === kind ? [r.body] : []));
const rowsOf = async (kind: Kind): Promise<unknown[]> => (fromLocal() ? localBodies(kind) : ((await db()`SELECT body FROM content_item WHERE kind = ${kind} ORDER BY id`) as { body: unknown }[]).map((r) => r.body));
const rowOf = async (kind: Kind, id: string): Promise<unknown | undefined> =>
  fromLocal() ? (await localBodies(kind)).find((b) => (b as { id?: string }).id === id) : ((await db()`SELECT body FROM content_item WHERE kind = ${kind} AND id = ${id}`) as { body: unknown }[])[0]?.body;

// 캐시 항목은 작게 나눈다. 페이지가 읽은 항목이 페이지마다 빌드 산출물에 실리므로, 전체 콘텐츠를 한 항목에 담으면 문제 수만큼 불어난다
export const getSchema = async (id: string): Promise<SchemaDef | undefined> => {
  "use cache";
  cacheLife("max");
  cacheTag(CONTENT_TAG);
  const body = await rowOf("schema", id);
  return body === undefined ? undefined : SchemaDefSchema.parse(body);
};
export const getProblem = async (id: string): Promise<Problem | undefined> => {
  "use cache";
  cacheLife("max");
  cacheTag(CONTENT_TAG);
  const body = await rowOf("problem", id);
  return body === undefined ? undefined : ProblemSchema.parse(body);
};
export const listProblemMeta = async (): Promise<ProblemMeta[]> => {
  "use cache";
  cacheLife("max");
  cacheTag(CONTENT_TAG);
  return (await rowsOf("problem"))
    .map((b) => ProblemSchema.parse(b))
    .map((p) => ({ id: p.id, title: p.title, schema: p.schema, difficulty: p.difficulty, format: p.format, sourceType: p.sourceType, tags: p.tags, skills: p.skills, timeLimitMin: p.timeLimitMin ?? null, blanks: Boolean(p.blanks && !p.script) }));
};
export const listSchemaMeta = async (): Promise<SchemaMeta[]> => {
  "use cache";
  cacheLife("max");
  cacheTag(CONTENT_TAG);
  return (await rowsOf("schema")).map((b) => SchemaDefSchema.parse(b)).map((s) => ({ id: s.id, locked: s.locked, domain: s.domain }));
};
export const listSets = async (): Promise<ProblemSet[]> => {
  "use cache";
  cacheLife("max");
  cacheTag(CONTENT_TAG);
  return (await rowsOf("set")).map((b) => ProblemSetSchema.parse(b));
};
export const listDecks = async (): Promise<CardDeck[]> => {
  "use cache";
  cacheLife("max");
  cacheTag(CONTENT_TAG);
  return (await rowsOf("deck")).map((b) => CardDeckSchema.parse(b)).sort((a, b) => a.order - b.order);
};
export const listSyntax = async (): Promise<SyntaxRef[]> => {
  "use cache";
  cacheLife("max");
  cacheTag(CONTENT_TAG);
  return (await rowsOf("syntax")).map((b) => SyntaxRefSchema.parse(b));
};
export const listSkills = async (): Promise<Skill[]> => {
  "use cache";
  cacheLife("max");
  cacheTag(CONTENT_TAG);
  return (await rowsOf("skill")).map((b) => SkillSchema.parse(b)).sort((a, b) => a.order - b.order);
};
export const getSet = async (id: string): Promise<ProblemSet | undefined> => (await listSets()).find((s) => s.id === id);
/** 세트의 문제를 세트에 적힌 순서로. 한 번의 조회로 읽는다 */
export const setProblems = async (set: ProblemSet): Promise<Problem[]> => {
  "use cache";
  cacheLife("max");
  cacheTag(CONTENT_TAG);
  const bodies = fromLocal() ? await localBodies("problem") : ((await db()`SELECT body FROM content_item WHERE kind = 'problem' AND id = ANY(${set.problems}::text[])`) as { body: unknown }[]).map((r) => r.body);
  const byId = new Map(bodies.map((b) => ProblemSchema.parse(b)).map((p) => [p.id, p]));
  return set.problems.map((id) => {
    const p = byId.get(id);
    if (!p) throw new Error(`unknown problem ${id}`);
    return p;
  });
};
