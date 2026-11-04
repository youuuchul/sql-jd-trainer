/** 주석과 문자열 리터럴을 고려한 최소 SQL 유틸. 파서가 아니라 토큰 단위 보조 함수다. */

export const stripComments = (sql: string): string => {
  let out = "";
  let i = 0;
  while (i < sql.length) {
    const ch = sql[i];
    const next = sql[i + 1];
    if (ch === "'" || ch === '"' || ch === "`") {
      const quote = ch;
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === "\\" && quote !== "`") {
          j += 2;
          continue;
        }
        if (sql[j] === quote) {
          if (sql[j + 1] === quote) {
            j += 2;
            continue;
          }
          break;
        }
        j++;
      }
      out += sql.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    if (ch === "-" && next === "-") {
      while (i < sql.length && sql[i] !== "\n") i++;
      continue;
    }
    if (ch === "#") {
      while (i < sql.length && sql[i] !== "\n") i++;
      continue;
    }
    if (ch === "/" && next === "*") {
      const end = sql.indexOf("*/", i + 2);
      i = end === -1 ? sql.length : end + 2;
      continue;
    }
    out += ch;
    i++;
  }
  return out;
};

/** 세미콜론으로 끝나는 단일 문장만 허용하고 끝의 세미콜론을 뗀다. */
export const singleStatement = (sql: string): string => {
  const cleaned = stripComments(sql).trim().replace(/;+\s*$/, "");
  if (/;/.test(stripStrings(cleaned))) throw new Error("한 번에 한 문장만 실행할 수 있습니다.");
  return cleaned;
};

const stripStrings = (sql: string): string => sql.replace(/'(?:[^'\\]|\\.|'')*'|"(?:[^"\\]|\\.)*"|`[^`]*`/g, "''");

export const isReadOnly = (sql: string): boolean => {
  const body = stripStrings(stripComments(sql)).trim().toLowerCase();
  if (!/^(select|with)\b/.test(body)) return false;
  return !/\b(insert|update|delete|drop|alter|create|truncate(?!\s*\()|grant|revoke|replace\s+into|merge|call|load|into\s+(outfile|dumpfile)|copy|attach|install|pragma|set\s+)\b/.test(body);
};

/**
 * 이름이 name인 함수 호출을 찾아 인자 배열을 변환 함수에 넘기고 호출 전체를 치환한다.
 * 괄호 중첩과 문자열 리터럴을 고려한다. 대소문자를 구분하지 않는다.
 */
export const rewriteCalls = (sql: string, name: string, fn: (args: string[]) => string): string => {
  const re = new RegExp(`\\b${name}\\s*\\(`, "gi");
  let out = "";
  let cursor = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) {
    const start = m.index;
    if (start < cursor) continue;
    const open = start + m[0].length - 1;
    const close = findClose(sql, open);
    if (close === -1) break;
    const args = splitArgs(sql.slice(open + 1, close));
    const replaced = fn(args);
    out += sql.slice(cursor, start) + replaced;
    cursor = close + 1;
    re.lastIndex = cursor;
  }
  return out + sql.slice(cursor);
};

const findClose = (sql: string, open: number): number => {
  let depth = 0;
  let i = open;
  while (i < sql.length) {
    const ch = sql[i];
    if (ch === "'" || ch === '"' || ch === "`") {
      const quote = ch;
      i++;
      while (i < sql.length && sql[i] !== quote) i++;
      i++;
      continue;
    }
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) return i;
    }
    i++;
  }
  return -1;
};

const splitArgs = (inner: string): string[] => {
  const args: string[] = [];
  let depth = 0;
  let cur = "";
  let i = 0;
  while (i < inner.length) {
    const ch = inner[i];
    if (ch === "'" || ch === '"' || ch === "`") {
      const quote = ch;
      let j = i + 1;
      while (j < inner.length && inner[j] !== quote) j++;
      cur += inner.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      args.push(cur.trim());
      cur = "";
      i++;
      continue;
    }
    cur += ch;
    i++;
  }
  if (cur.trim() || args.length) args.push(cur.trim());
  return args;
};

/** 캐시 키용 정규화. 주석 제거, 공백 압축, 소문자, 끝 세미콜론 제거. */
export const normalizeSql = (sql: string): string =>
  stripComments(sql).replace(/\s+/g, " ").trim().replace(/;+$/, "").toLowerCase();
