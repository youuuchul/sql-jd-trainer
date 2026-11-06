import { z } from "zod";

export const DIALECTS = ["postgres", "bigquery", "mysql"] as const;
export type Dialect = (typeof DIALECTS)[number];
export const DIALECT_LABEL: Record<Dialect, string> = {
  postgres: "PostgreSQL",
  bigquery: "BigQuery",
  mysql: "MySQL",
};

/** 화면에서 고를 수 있는 방언. MySQL 은 실행 코드만 두고 화면에서는 숨긴다 */
export const UI_DIALECTS = ["postgres", "bigquery"] as const satisfies readonly Dialect[];

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
  /** 비밀번호로 잠근 스키마. 이 스키마의 세트·문제는 잠금 해제 후에만 열린다. */
  locked: z.boolean().default(false),
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

export const ProblemFormatSchema = z.enum(["write", "fix", "mcq", "predict", "spot", "review"]);
export type ProblemFormat = z.infer<typeof ProblemFormatSchema>;
export const FORMAT_LABEL: Record<ProblemFormat, string> = {
  write: "쿼리 작성",
  fix: "깨진 쿼리 고치기",
  mcq: "객관식",
  predict: "출력 예측",
  spot: "결과 이상 찾기",
  review: "쿼리 리뷰",
};

/** 출력 예측용 입력 데이터 표. columns/rows는 빌드가 sql.postgres 실행 결과로 채운다. */
export const InputTableSchema = z.object({
  title: z.string().default("입력 데이터"),
  sql: z.partialRecord(DialectSchema, z.string()),
  columns: z.array(z.string()).default([]),
  rows: z.array(z.array(CellSchema)).default([]),
});
export type InputTable = z.infer<typeof InputTableSchema>;

/** 결과 이상 찾기용 잘못된 쿼리와 그 결과. columns/rows/anomalyRows는 빌드가 채운다. */
export const SpotSchema = z.object({
  sql: z.partialRecord(DialectSchema, z.string()),
  columns: z.array(z.string()).default([]),
  rows: z.array(z.array(CellSchema)).default([]),
  /** 정답 결과에 없는 행의 인덱스(0부터) */
  anomalyRows: z.array(z.number()).default([]),
});
export type Spot = z.infer<typeof SpotSchema>;

export const REVIEW_CATEGORIES = ["fanout", "duplicate", "null", "int-division", "boundary", "join", "definition"] as const;
export const ReviewCategorySchema = z.enum(REVIEW_CATEGORIES);
export type ReviewCategory = z.infer<typeof ReviewCategorySchema>;
/** 쿼리 리뷰 채점 체크리스트. label 은 유형 이름, cue 는 대표 실수 */
export const REVIEW_CATEGORY: Record<ReviewCategory, { label: string; cue: string }> = {
  fanout: { label: "조인 팬아웃", cue: "1:N 조인 뒤 1쪽 값 합산" },
  duplicate: { label: "중복 집계", cue: "COUNT(*)·DISTINCT 누락" },
  null: { label: "NULL 처리", cue: "NULL·빈 값 그룹, 분모에서 빠짐" },
  "int-division": { label: "정수 나눗셈", cue: "정수끼리 나눠 소수 버림" },
  boundary: { label: "기간·경계", cue: "BETWEEN 끝 시각, 이상/초과" },
  join: { label: "조인 조건", cue: "LEFT JOIN 무력화, 키 정규화 누락" },
  definition: { label: "지표 정의", cue: "필터·분모·평균의 평균" },
};

/** 쿼리 리뷰의 줄 지정. match 중 하나가 들어 있는 줄(대소문자 무시). lines 는 빌드가 방언별로 채운다(1부터) */
const ReviewLineRefSchema = z.object({
  match: z.array(z.string()).min(1),
  /** 이 방언에서만 해당한다. 없으면 세 방언 모두 */
  dialects: z.array(DialectSchema).optional(),
  lines: z.partialRecord(DialectSchema, z.array(z.number())).default({}),
});

export const ReviewDefectSchema = ReviewLineRefSchema.extend({
  category: ReviewCategorySchema,
  title: z.string(),
  explanation: z.string(),
});
export type ReviewDefect = z.infer<typeof ReviewDefectSchema>;

/** 의심스러워 보이지만 맞는 줄. 표시하면 오탐으로 센다 */
export const ReviewDecoySchema = ReviewLineRefSchema.extend({ explanation: z.string() });
export type ReviewDecoy = z.infer<typeof ReviewDecoySchema>;

/** 쿼리 리뷰용 검토 대상 쿼리. results 는 빌드가 방언별 실행 결과와 정답에 없는 행 인덱스로 채운다 */
export const ReviewSchema = z.object({
  sql: z.partialRecord(DialectSchema, z.string()),
  defects: z.array(ReviewDefectSchema).min(1),
  decoys: z.array(ReviewDecoySchema).default([]),
  results: z
    .partialRecord(
      DialectSchema,
      z.object({
        columns: z.array(z.string()),
        rows: z.array(z.array(CellSchema)),
        anomalyRows: z.array(z.number()),
      }),
    )
    .default({}),
});
export type Review = z.infer<typeof ReviewSchema>;

export const DifficultySchema = z.enum(["basic", "intermediate", "advanced"]);
export type Difficulty = z.infer<typeof DifficultySchema>;
export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  basic: "입문",
  intermediate: "중급",
  advanced: "상급",
};

export const SourceTypeSchema = z.enum(["basic", "expected", "domain", "jd"]);
export type SourceType = z.infer<typeof SourceTypeSchema>;
export const SOURCE_LABEL: Record<SourceType, string> = {
  basic: "기초 문법",
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
  input: InputTableSchema.optional(),
  spot: SpotSchema.optional(),
  review: ReviewSchema.optional(),
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

export const SetCategorySchema = z.enum(["basics", "job", "kpi", "review", "archive"]);
export type SetCategory = z.infer<typeof SetCategorySchema>;
export const SET_CATEGORY_LABEL: Record<SetCategory, string> = {
  basics: "기초 문법",
  job: "직무별 실무",
  kpi: "KPI 대시보드",
  review: "쿼리 리뷰",
  archive: "비공개 복습 아카이브",
};

export const ProblemSetSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  category: SetCategorySchema,
  /** 같은 분류 안에서 정렬 순서(작을수록 앞) */
  order: z.number().default(100),
  schema: z.string(),
  mode: z.enum(["practice", "mock"]),
  problems: z.array(z.string()).min(1),
  timeLimitMin: z.number().optional(),
});
export type ProblemSet = z.infer<typeof ProblemSetSchema>;

/** 하루 카드: 빈칸 하나를 채우는 함수·인자 암기 카드. template 의 ___ 자리에 answers 중 하나가 들어가면 실행 가능한 SQL이 된다. */
export const CardSchema = z.object({
  id: z.string(),
  /** common: 세 방언 모두 같은 답 */
  dialect: z.enum(["common", ...DIALECTS]),
  /** 무엇을 하려는지 한국어 한 문장 */
  prompt: z.string(),
  /** 빈칸 ___ 이 정확히 1개. 테이블 없이 리터럴·CTE만으로 실행된다 */
  template: z.string(),
  answers: z.array(z.string()).min(1),
  caseSensitive: z.boolean().default(false),
  hint: z.string(),
  explanation: z.string(),
  /** core: 실무에서 자주 쓰는 기본, applied: 응용. 새 카드는 core 위주로 나온다 */
  level: z.enum(["core", "applied"]).default("core"),
  /** 풀고 나서 함께 보여 줄 문법 항목(SyntaxRef.id) */
  syntax: z.array(z.string()).default([]),
  /** 빌드가 answers[0] 을 넣어 실행한 결과로 채운다 */
  result: z.object({ columns: z.array(z.string()), rows: z.array(z.array(CellSchema)) }).optional(),
});
export type Card = z.infer<typeof CardSchema>;

export const CardDeckSchema = z.object({
  id: z.string(),
  title: z.string(),
  order: z.number().default(100),
  cards: z.array(CardSchema).min(1),
});
export type CardDeck = z.infer<typeof CardDeckSchema>;

/** 카드에 붙는 함수·구문 문법. forms 는 방언별 형태(common 은 세 방언 공통) */
export const SyntaxRefSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  forms: z
    .array(
      z.object({
        dialect: z.enum(["common", ...DIALECTS]),
        code: z.string(),
        note: z.string().optional(),
      }),
    )
    .min(1),
});
export type SyntaxRef = z.infer<typeof SyntaxRefSchema>;
