import { rewriteCalls } from "./sql-utils";

/**
 * BigQuery 표준 SQL을 DuckDB가 받는 형태로 바꾼다.
 * 지원 범위는 DA 실무 빈출 함수에 한정하며, 바꾸지 못한 문법은 DuckDB 에러로 드러난다.
 */

const UNIT = /^(MICROSECOND|MILLISECOND|SECOND|MINUTE|HOUR|DAY|WEEK|ISOWEEK|MONTH|QUARTER|YEAR)(\(\w+\))?$/i;

const unitLiteral = (u: string): string => {
  const m = u.trim().match(UNIT);
  if (!m) return u.trim();
  return `'${m[1].toLowerCase()}'`;
};

const TYPE_RE = /\b(INT64|FLOAT64|STRING|BOOL|NUMERIC|BIGNUMERIC|BYTES|DATETIME)\b/gi;
const TYPE_MAP: Record<string, string> = {
  INT64: "BIGINT",
  FLOAT64: "DOUBLE",
  STRING: "VARCHAR",
  BOOL: "BOOLEAN",
  NUMERIC: "DECIMAL(38,9)",
  BIGNUMERIC: "DECIMAL(38,9)",
  BYTES: "BLOB",
  DATETIME: "TIMESTAMP",
};

export const BQ_MACROS = [
  "CREATE OR REPLACE MACRO safe_divide(a, b) AS a / NULLIF(b, 0)",
  "CREATE OR REPLACE MACRO format_date(f, d) AS strftime(d, f)",
  "CREATE OR REPLACE MACRO format_timestamp(f, d) AS strftime(d, f)",
  "CREATE OR REPLACE MACRO format_datetime(f, d) AS strftime(d, f)",
  "CREATE OR REPLACE MACRO parse_date(f, s) AS CAST(strptime(s, f) AS DATE)",
  "CREATE OR REPLACE MACRO parse_timestamp(f, s) AS CAST(strptime(s, f) AS TIMESTAMP)",
  "CREATE OR REPLACE MACRO safe_cast_int64(x) AS TRY_CAST(x AS BIGINT)",
  "CREATE OR REPLACE MACRO div(a, b) AS CAST(a AS BIGINT) // CAST(b AS BIGINT)",
];

const WEEKDAY = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

/**
 * BigQuery 주 단위의 시작 요일(DuckDB dayofweek, 일요일 0). WEEK 는 일요일 시작, WEEK(요일)은 그 요일, ISOWEEK 는 월요일.
 * 주 단위가 아니면 null.
 */
const weekStart = (u: string): number | null => {
  const m = u.trim().match(/^(ISOWEEK|WEEK)(?:\(\s*(\w+)\s*\))?$/i);
  if (!m) return null;
  if (m[1].toUpperCase() === "ISOWEEK") return 1;
  if (!m[2]) return 0;
  const k = WEEKDAY.indexOf(m[2].toUpperCase());
  return k === -1 ? null : k;
};

/** DuckDB 'week' 는 월요일 시작이라 그 외 요일은 날짜에서 요일 차이만큼 뺀다 */
const truncWeek = (x: string, k: number, asDate: boolean): string => {
  if (k === 1) return `DATE_TRUNC('week', ${x})`;
  const back = `CAST((dayofweek(${x}) - ${k} + 7) % 7 AS INTEGER)`;
  return asDate ? `CAST((CAST(${x} AS DATE) - ${back}) AS DATE)` : `(DATE_TRUNC('day', ${x}) - to_days(${back}))`;
};

/** 시간대 인자 → UTC 기준 시차(시간). 시드 시각은 시간대 없는 UTC 값이라 고정 시차로 바꾼다. 모르는 시간대면 null */
const TZ_HOURS: Record<string, number> = { "asia/seoul": 9, "asia/tokyo": 9, utc: 0, "etc/utc": 0 };
const tzHours = (arg: string): number | null => {
  const m = arg.trim().match(/^'([^']+)'$/);
  if (!m) return null;
  const name = m[1].trim().toLowerCase();
  if (name in TZ_HOURS) return TZ_HOURS[name];
  const off = name.match(/^([+-])(\d{1,2})(?::?00)?$/);
  return off ? (off[1] === "-" ? -1 : 1) * Number(off[2]) : null;
};
const shift = (x: string, h: number) => (h === 0 ? `CAST(${x} AS TIMESTAMP)` : `(CAST(${x} AS TIMESTAMP) ${h > 0 ? "+" : "-"} INTERVAL ${Math.abs(h)} HOUR)`);

export const bqToDuckdb = (input: string): string => {
  let sql = input;
  // 식별자 백틱 -> 큰따옴표. project.dataset.table 형태는 마지막 조각만 남긴다.
  sql = sql.replace(/`([^`]+)`/g, (_, id: string) => {
    const parts = id.split(".");
    return `"${parts[parts.length - 1]}"`;
  });
  // DATE_TRUNC(d, MONTH) -> DATE_TRUNC('month', d)
  for (const fn of ["DATE_TRUNC", "TIMESTAMP_TRUNC", "DATETIME_TRUNC"]) {
    sql = rewriteCalls(sql, fn, (a) => {
      if (a.length !== 2) return `${fn}(${a.join(", ")})`;
      const k = weekStart(a[1]);
      if (k !== null) return truncWeek(a[0], k, fn === "DATE_TRUNC");
      return UNIT.test(a[1]) ? `DATE_TRUNC(${unitLiteral(a[1])}, ${a[0]})` : `${fn}(${a.join(", ")})`;
    });
  }
  // DATE_DIFF(a, b, DAY) -> DATE_DIFF('day', b, a). 주 단위는 두 날짜를 주 시작으로 자른 뒤 일수 / 7
  for (const fn of ["DATE_DIFF", "TIMESTAMP_DIFF", "DATETIME_DIFF"]) {
    sql = rewriteCalls(sql, fn, (a) => {
      if (a.length !== 3) return `${fn}(${a.join(", ")})`;
      const k = weekStart(a[2]);
      if (k !== null) return `(DATE_DIFF('day', ${truncWeek(a[1], k, true)}, ${truncWeek(a[0], k, true)}) // 7)`;
      return `DATE_DIFF(${unitLiteral(a[2])}, ${a[1]}, ${a[0]})`;
    });
  }
  // DATE_ADD(d, INTERVAL 7 DAY) -> CAST(d + INTERVAL 7 DAY AS DATE). DuckDB는 DATE + INTERVAL이 TIMESTAMP라 DATE로 되돌린다.
  for (const [fn, op] of [["DATE_ADD", "+"], ["DATE_SUB", "-"]] as const) {
    sql = rewriteCalls(sql, fn, (a) => (a.length === 2 ? `CAST((${a[0]} ${op} ${a[1]}) AS DATE)` : `${fn}(${a.join(", ")})`));
  }
  for (const [fn, op] of [["TIMESTAMP_ADD", "+"], ["TIMESTAMP_SUB", "-"], ["DATETIME_ADD", "+"], ["DATETIME_SUB", "-"]] as const) {
    sql = rewriteCalls(sql, fn, (a) => (a.length === 2 ? `(${a[0]} ${op} ${a[1]})` : `${fn}(${a.join(", ")})`));
  }
  // EXTRACT(DATE FROM ts) -> CAST(ts AS DATE)
  sql = rewriteCalls(sql, "EXTRACT", (a) => {
    const m = a[0]?.match(/^\s*DATE\s+FROM\s+([\s\S]+)$/i);
    return m ? `CAST(${m[1]} AS DATE)` : `EXTRACT(${a.join(", ")})`;
  });
  // DATE(ts) -> CAST(ts AS DATE), DATE(y, m, d) -> make_date
  // DATE(ts, 'Asia/Seoul')·DATETIME(ts, tz) 는 UTC 시각을 그 시간대 현지 값으로, TIMESTAMP(현지 값, tz) 는 현지 값을 UTC 로
  const tz = (a: string[]) => (a.length === 2 ? tzHours(a[1]) : null);
  sql = rewriteCalls(sql, "DATE", (a) => {
    const h = tz(a);
    if (h !== null) return `CAST(${shift(a[0], h)} AS DATE)`;
    return a.length === 1 ? `CAST(${a[0]} AS DATE)` : a.length === 3 ? `make_date(${a.join(", ")})` : `DATE(${a.join(", ")})`;
  });
  sql = rewriteCalls(sql, "TIMESTAMP", (a) => {
    const h = tz(a);
    if (h !== null) return shift(a[0], -h);
    return a.length === 1 ? `CAST(${a[0]} AS TIMESTAMP)` : `TIMESTAMP(${a.join(", ")})`;
  });
  sql = rewriteCalls(sql, "DATETIME", (a) => {
    const h = tz(a);
    if (h !== null) return shift(a[0], h);
    return a.length === 1 ? `CAST(${a[0]} AS TIMESTAMP)` : `DATETIME(${a.join(", ")})`;
  });
  // SAFE_CAST(x AS INT64) -> TRY_CAST(x AS BIGINT)
  sql = sql.replace(/\bSAFE_CAST\s*\(/gi, "TRY_CAST(");
  // COUNTIF는 BigQuery에서 조건이 전부 NULL이어도 0이다. DuckDB count_if는 NULL을 돌려주므로 보정한다.
  sql = rewriteCalls(sql, "COUNTIF", (a) => `COALESCE(COUNT_IF(${a.join(", ")}), 0)`);
  sql = sql.replace(/\bCURRENT_DATE\s*\(\s*\)/gi, "CURRENT_DATE");
  sql = sql.replace(/\bCURRENT_TIMESTAMP\s*\(\s*\)/gi, "CURRENT_TIMESTAMP");
  sql = sql.replace(/\bAPPROX_COUNT_DISTINCT\s*\(/gi, "APPROX_COUNT_DISTINCT(");
  sql = sql.replace(/\[\s*(SAFE_)?OFFSET\s*\(([^)]+)\)\s*\]/gi, (_, __, i: string) => `[${i.trim()} + 1]`);
  sql = sql.replace(/\[\s*(SAFE_)?ORDINAL\s*\(([^)]+)\)\s*\]/gi, (_, __, i: string) => `[${i.trim()}]`);
  sql = sql.replace(/\bEXCEPT\s+DISTINCT\b/gi, "EXCEPT").replace(/\bINTERSECT\s+DISTINCT\b/gi, "INTERSECT").replace(/\bUNION\s+DISTINCT\b/gi, "UNION");
  sql = sql.replace(TYPE_RE, (t) => TYPE_MAP[t.toUpperCase()] ?? t);
  return sql;
};
