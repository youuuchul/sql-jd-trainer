import { z } from "zod";

export const DIALECTS = ["postgres", "bigquery", "mysql"] as const;
export type Dialect = (typeof DIALECTS)[number];
export const DIALECT_LABEL: Record<Dialect, string> = {
  postgres: "PostgreSQL",
  bigquery: "BigQuery",
  mysql: "MySQL",
};

export const DialectSchema = z.enum(DIALECTS);

export const CellSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
export type Cell = z.infer<typeof CellSchema>;

export const ColumnTypeSchema = z.enum(["int", "bigint", "decimal", "text", "date", "timestamp", "bool"]);
export type ColumnType = z.infer<typeof ColumnTypeSchema>;

export const SeedColumnSchema = z.object({
  name: z.string(),
  type: ColumnTypeSchema,
  description: z.string().optional(),
});
export type SeedColumn = z.infer<typeof SeedColumnSchema>;

export const SeedTableSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  grain: z.string().optional(),
  columns: z.array(SeedColumnSchema).min(1),
  rows: z.array(z.array(CellSchema)),
});
export type SeedTable = z.infer<typeof SeedTableSchema>;

export const SchemaDefSchema = z.object({
  id: z.string(),
  title: z.string(),
  domain: z.string(),
  timezone: z.string().default("Asia/Seoul"),
  notes: z.array(z.string()).default([]),
  metrics: z.array(z.object({ name: z.string(), definition: z.string() })).default([]),
  tables: z.array(SeedTableSchema).min(1),
});
export type SchemaDef = z.infer<typeof SchemaDefSchema>;

export const ExpectedSchema = z.object({
  columns: z.array(z.string()).default([]),
  rows: z.array(z.array(CellSchema)).default([]),
  ordered: z.boolean().default(false),
  tolerance: z.number().default(0.0001),
  checkColumnNames: z.boolean().default(false),
});
export type Expected = z.infer<typeof ExpectedSchema>;

export const WrongPatternSchema = z.object({
  label: z.string(),
  explanation: z.string(),
  sql: z.partialRecord(DialectSchema, z.string()).optional(),
  resultHash: z.string().optional(),
});
export type WrongPattern = z.infer<typeof WrongPatternSchema>;

export const ProblemFormatSchema = z.enum(["write", "fix", "mcq"]);
export type ProblemFormat = z.infer<typeof ProblemFormatSchema>;

export const DifficultySchema = z.enum(["basic", "intermediate", "advanced"]);
export type Difficulty = z.infer<typeof DifficultySchema>;
export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  basic: "입문",
  intermediate: "중급",
  advanced: "상급",
};

export const SourceTypeSchema = z.enum(["expected", "domain", "jd"]);
export type SourceType = z.infer<typeof SourceTypeSchema>;
export const SOURCE_LABEL: Record<SourceType, string> = {
  expected: "개인 복습",
  domain: "도메인 문제",
  jd: "JD 기반",
};

export const ProblemSchema = z.object({
  id: z.string(),
  schema: z.string(),
  title: z.string(),
  sourceType: SourceTypeSchema,
  format: ProblemFormatSchema,
  difficulty: DifficultySchema,
  tags: z.array(z.string()).default([]),
  prompt: z.string(),
  requirements: z.array(z.string()).default([]),
  hints: z.array(z.string()).default([]),
  timeLimitMin: z.number().optional(),
  starterSql: z.partialRecord(DialectSchema, z.string()).optional(),
  solutions: z.partialRecord(DialectSchema, z.string()).optional(),
  expected: ExpectedSchema.optional(),
  wrongPatterns: z.array(WrongPatternSchema).default([]),
  explanation: z.string().default(""),
  dialectNotes: z.partialRecord(DialectSchema, z.string()).optional(),
  choices: z
    .object({
      options: z.array(z.object({ key: z.string(), text: z.string() })),
      answer: z.array(z.string()),
      multiple: z.boolean().default(false),
    })
    .optional(),
});
export type Problem = z.infer<typeof ProblemSchema>;

export const ProblemSetSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  schema: z.string(),
  mode: z.enum(["practice", "mock"]),
  problems: z.array(z.string()).min(1),
  timeLimitMin: z.number().optional(),
});
export type ProblemSet = z.infer<typeof ProblemSetSchema>;
