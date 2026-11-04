/**
 * 스키마 시드 생성기 공용 유틸. 스키마마다 scripts/gen-schema-<id>.ts 를 두고 이 모듈을 쓴다.
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { SchemaDefSchema, type Cell, type SchemaDef, type SeedTable } from "../lib/content/types";

/** mulberry32 시드 고정 난수 */
export const createRng = (seed: number) => {
  let s = seed;
  const rand = () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
  const chance = (p: number) => rand() < p;
  return { rand, int, pick, chance };
};

const pad = (n: number) => String(n).padStart(2, "0");
export const utc = (y: number, m: number, d: number, h = 0, mi = 0, s = 0) => new Date(Date.UTC(y, m - 1, d, h, mi, s));
export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);
export const addMinutes = (d: Date, n: number) => new Date(d.getTime() + n * 60000);
export const fmtDate = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
export const fmtTs = (d: Date) => `${fmtDate(d)} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;

export const table = (name: string, description: string, grain: string, columns: SeedTable["columns"], rows: Cell[][]): SeedTable => ({
  name,
  description,
  grain,
  columns,
  rows,
});

/** 검증 후 content/schemas/<id>.json 으로 쓴다 */
export const writeSchema = (schema: SchemaDef) => {
  const parsed = SchemaDefSchema.parse(schema);
  for (const t of parsed.tables) {
    for (const r of t.rows) if (r.length !== t.columns.length) throw new Error(`${t.name}: 열 수 불일치 ${JSON.stringify(r)}`);
  }
  const out = path.join(process.cwd(), "content/schemas", `${parsed.id}.json`);
  writeFileSync(out, JSON.stringify(parsed, null, 1) + "\n");
  console.log("written", out, parsed.tables.map((t) => `${t.name}=${t.rows.length}`).join(" "));
};
