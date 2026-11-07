/** 공고 본문에서 이 앱이 연습시키는 SQL·쿼리 실무와 맞닿은 용어. 화면 강조용이라 역량 사전(lib/jd)과 별개다. */
const SQL_TERMS = [
  "SQL",
  "SQLD",
  "SQLP",
  "T-SQL",
  "PL/SQL",
  "Spark SQL",
  "쿼리",
  "서브쿼리",
  "서브 쿼리",
  "Subquery",
  "JOIN",
  "조인",
  "CTE",
  "윈도우 함수",
  "Window Function",
  "집계",
  "GROUP BY",
  "BigQuery",
  "빅쿼리",
  "PostgreSQL",
  "Postgres",
  "MySQL",
  "MariaDB",
  "Redshift",
  "Snowflake",
  "Hive",
  "Presto",
  "Trino",
  "Athena",
  "RDBMS",
  "데이터 추출",
  "데이터 마트",
  "데이터 웨어하우스",
  "ETL",
  "ELT",
];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\/-]/g, "\\$&");

/** 용어 안의 공백은 있어도 없어도 되고(윈도우함수), 여러 칸이어도 된다. */
const toSource = (term: string) => term.split(/\s+/).map(escape).join("[ \\t]*");

/**
 * 영문 용어는 앞뒤가 영문·숫자·밑줄이면 단어 일부로 보고 잡지 않는다(NoSQL, JOINED).
 * 한글은 조사가 바로 붙으므로(SQL로, 쿼리를) 한글 쪽 경계는 보지 않는다.
 */
const SQL_RE = new RegExp(
  `(?<![A-Za-z0-9_])(?:${[...SQL_TERMS]
    .sort((a, b) => b.length - a.length)
    .map(toSource)
    .join("|")})(?![A-Za-z0-9_])`,
  "gi",
);

/** 한 줄 안의 SQL 용어 위치 [시작, 끝) 목록. */
export function findSqlRanges(line: string): Array<[number, number]> {
  return [...line.matchAll(SQL_RE)].map((m) => [m.index, m.index + m[0].length]);
}

/** 본문을 줄로 나눈다. 줄 수와 순서는 원문 그대로다. */
export const splitLines = (text: string): string[] => text.split(/\r?\n/);

/** SQL 용어가 한 번이라도 나오는 줄 수. */
export const countSqlLines = (text: string): number => splitLines(text).filter((l) => findSqlRanges(l).length > 0).length;
