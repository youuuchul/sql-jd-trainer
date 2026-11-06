/**
 * 화면에 보이는 예시 SQL(카드 template, 문제 solutions·starterSql·spot.sql·review.sql)을 한 가지 양식으로 맞춘다.
 * 실행: npx tsx scripts/format-sql.ts          # 제자리 수정
 *       npx tsx scripts/format-sql.ts --check  # 바뀔 파일만 출력하고 있으면 exit 1
 *
 * 양식
 * - 키워드·함수 대문자, 들여쓰기 2칸
 * - SELECT, FROM, WHERE, GROUP BY, HAVING, ORDER BY, LIMIT, UNION ALL 은 새 줄에서 시작
 * - SELECT 항목이 둘 이상이면 한 줄에 하나, 하나면 SELECT 옆에
 * - FROM, WHERE 등은 첫 내용을 같은 줄에, 이어지는 JOIN, AND/OR 는 들여쓴 새 줄
 * - WITH name AS ( 다음 줄부터 본문을 들여쓰고 ) 로 닫는다
 * - 폭 안에 들어가는 괄호식과 WHEN 하나짜리 CASE 는 한 줄
 * - 리터럴 데이터 행(FROM 없는 SELECT)은 한 줄에 한 행: UNION ALL SELECT 2, 'b'
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { format, type SqlLanguage } from "sql-formatter";

type Dialect = "postgres" | "bigquery" | "mysql" | "common";
const LANGUAGE: Record<Dialect, SqlLanguage> = { postgres: "postgresql", bigquery: "bigquery", mysql: "mysql", common: "sql" };
const ROOT = ["SELECT", "SELECT DISTINCT", "FROM", "WHERE", "GROUP BY", "HAVING", "ORDER BY", "LIMIT", "OFFSET", "QUALIFY", "WITH", "WITH RECURSIVE", "PARTITION BY"];
const LIST_CLAUSES = new Set(["GROUP BY", "ORDER BY", "PARTITION BY"]);
const JOIN_RE = /^((LEFT|RIGHT|FULL|INNER|CROSS)\s+)?(OUTER\s+)?JOIN\b/;

interface Line {
  indent: number;
  text: string;
}

const toLines = (sql: string): Line[] =>
  sql.split("\n").map((raw) => {
    const text = raw.trimStart();
    return { indent: raw.length - text.length, text: text.trimEnd() };
  });
const fromLines = (lines: Line[]) => lines.map((l) => " ".repeat(l.indent) + l.text).join("\n");

/** i 번째 줄에서 시작하는 블록(들여쓰기가 더 깊은 다음 줄들)의 끝(제외) */
const blockEnd = (lines: Line[], i: number) => {
  let j = i + 1;
  while (j < lines.length && lines[j].indent > lines[i].indent) j++;
  return j;
};

const joinInline = (parts: string[]) =>
  parts
    .join(" ")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/\s+,/g, ",");

/** 폭 안에 들어가는 괄호식·CASE 를 한 줄로 접는다. 서브쿼리(SELECT 포함)는 접지 않는다 */
const collapse = (lines: Line[], width: number): boolean => {
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const isParen = l.text.endsWith("(");
    const isCase = /(^|\s|\()CASE$/.test(l.text);
    if (!isParen && !isCase) continue;
    const end = blockEnd(lines, i);
    const closer = lines[end];
    if (!closer || closer.indent !== l.indent || !(isParen ? closer.text.startsWith(")") : /^END\b/.test(closer.text))) continue;
    const inner = lines.slice(i + 1, end);
    if (inner.some((x) => /^(SELECT|WITH)\b/.test(x.text))) continue;
    if (inner.some((x) => x.text.endsWith("(") || /(^|\s|\()CASE$/.test(x.text))) continue;
    if (isCase && inner.filter((x) => x.text.startsWith("WHEN")).length > 1) continue;
    const joined = joinInline([l.text, ...inner.map((x) => x.text), closer.text]);
    if (l.indent + joined.length > width) continue;
    lines.splice(i, end - i + 1, { indent: l.indent, text: joined });
    return true;
  }
  return false;
};

/** 블록의 최상위 항목(indent+2)별로 묶는다 */
const items = (lines: Line[], start: number, end: number, indent: number) => {
  const out: [number, number][] = [];
  for (let j = start; j < end; j++) {
    const closes = /^(\)|END\b)/.test(lines[j].text);
    if (lines[j].indent === indent + 2 && !(closes && out.length)) out.push([j, j + 1]);
    else if (out.length) out[out.length - 1][1] = j + 1;
  }
  return out;
};

/** FROM 없이 리터럴만 고르는 SELECT 인지: 블록 다음 같은 깊이 줄이 FROM 이 아니다 */
const isLiteralSelect = (lines: Line[], i: number, end: number) => {
  const next = lines[end];
  return !next || next.indent < lines[i].indent || !/^FROM\b/.test(next.text);
};

const mergeRoot = (lines: Line[], width: number): boolean => {
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!ROOT.includes(l.text)) continue;
    const end = blockEnd(lines, i);
    if (end === i + 1) continue;
    const its = items(lines, i + 1, end, l.indent);
    const flat = its.every(([a, b]) => b - a === 1);

    if (l.text.startsWith("WITH")) {
      for (let j = i + 1; j < end; j++) lines[j].indent -= 2;
      lines.splice(i, 2, { indent: l.indent, text: `${l.text} ${lines[i + 1].text}` });
      return true;
    }
    if (l.text.startsWith("SELECT")) {
      if (its.length === 1 && flat && l.indent + l.text.length + 1 + lines[i + 1].text.length <= width) {
        lines.splice(i, 2, { indent: l.indent, text: `${l.text} ${lines[i + 1].text}` });
        return true;
      }
      if (flat && isLiteralSelect(lines, i, end)) {
        const joined = `${l.text} ${lines.slice(i + 1, end).map((x) => x.text).join(" ")}`;
        if (l.indent + joined.length <= width) {
          lines.splice(i, end - i, { indent: l.indent, text: joined });
          return true;
        }
      }
      continue;
    }
    if (LIST_CLAUSES.has(l.text) && flat) {
      const joined = `${l.text} ${lines.slice(i + 1, end).map((x) => x.text).join(" ")}`;
      if (l.indent + joined.length <= width) {
        lines.splice(i, end - i, { indent: l.indent, text: joined });
        return true;
      }
    }
    // 첫 항목을 키워드 줄로 올리고, 그 항목의 이어지는 줄은 2칸 당긴다
    const [a, b] = its[0];
    for (let j = a + 1; j < b; j++) lines[j].indent -= 2;
    lines.splice(i, 2, { indent: l.indent, text: `${l.text} ${lines[a].text}` });
    return true;
  }
  return false;
};

/** 리터럴 행 SELECT 앞의 UNION ALL 을 한 줄로 */
const mergeUnion = (lines: Line[]): boolean => {
  for (let i = 0; i + 1 < lines.length; i++) {
    const l = lines[i];
    const next = lines[i + 1];
    if (!/^UNION( ALL)?$/.test(l.text) || next.indent !== l.indent || !/^SELECT\s/.test(next.text)) continue;
    const after = lines[i + 2];
    if (after && after.indent >= l.indent && !/^UNION\b/.test(after.text)) continue;
    lines.splice(i, 2, { indent: l.indent, text: `${l.text} ${next.text}` });
    return true;
  }
  return false;
};

/** 윈도우 프레임(ROWS/RANGE BETWEEN)은 ORDER BY 와 같은 깊이의 새 줄로, BETWEEN 의 AND 는 같은 줄로 */
const fixBetween = (lines: Line[]) => {
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].text.match(/^(.+?)\s+((ROWS|RANGE|GROUPS) BETWEEN\b.*)$/);
    if (m) {
      lines.splice(i + 1, 0, { indent: Math.max(lines[i].indent - 2, 0), text: m[2] });
      lines[i].text = m[1];
      continue;
    }
    const next = lines[i + 1];
    if (next && /\bBETWEEN\b/.test(lines[i].text) && !/\bBETWEEN\b.*\bAND\b/.test(lines[i].text) && /^AND\s/.test(next.text)) {
      lines[i].text = `${lines[i].text} ${next.text}`;
      lines.splice(i + 1, 1);
    }
  }
};

/** 여는 괄호로 끝나는 줄과 닫는 괄호로 시작하는 줄의 들여쓰기가 같아야 한다 */
const assertAligned = (lines: Line[]) => {
  const stack: number[] = [];
  for (const l of lines) {
    if (l.text.startsWith(")") && stack.length && stack.pop() !== l.indent) throw new Error(`괄호 들여쓰기 불일치: ${l.text}`);
    if (l.text.endsWith("(")) stack.push(l.indent);
  }
};

/** JOIN ... ON 에 이어지는 AND/OR 는 JOIN 보다 한 단계 더 들여 WHERE 조건과 구분한다 */
const indentJoinConditions = (lines: Line[]) => {
  for (let i = 0; i < lines.length; i++) {
    if (!/^(AND|OR)\b/.test(lines[i].text)) continue;
    let k = i - 1;
    while (k >= 0 && (lines[k].indent > lines[i].indent || (lines[k].indent === lines[i].indent && /^(AND|OR)\b/.test(lines[k].text)))) k--;
    if (k < 0 || lines[k].indent !== lines[i].indent || !JOIN_RE.test(lines[k].text)) continue;
    const end = blockEnd(lines, i);
    for (let j = i; j < end; j++) lines[j].indent += 2;
  }
};

export const formatSql = (sql: string, dialect: Dialect, width: number): string => {
  const raw = format(sql, {
    language: LANGUAGE[dialect],
    keywordCase: "upper",
    functionCase: "upper",
    dataTypeCase: "upper",
    identifierCase: "preserve",
    tabWidth: 2,
    logicalOperatorNewline: "before",
    expressionWidth: width,
  });
  // 포매터가 :: 뒤 자료형을 대문자로 바꾸지 않는다. 문자열 리터럴 밖만 고친다
  const typed = raw.split(/('(?:[^']|'')*')/).map((part, i) => (i % 2 ? part : part.replace(/::\s*([a-z_][a-z0-9_]*)/g, (_, t: string) => `::${t.toUpperCase()}`))).join("");
  const lines = toLines(typed);
  fixBetween(lines);
  for (let guard = 0; guard < 2000; guard++) {
    if (collapse(lines, width) || mergeRoot(lines, width) || mergeUnion(lines)) continue;
    indentJoinConditions(lines);
    assertAligned(lines);
    return fromLines(lines);
  }
  throw new Error("format loop did not settle");
};

const BLANK = "___";
const answerPattern = (answer: string) => new RegExp(answer.trim().split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+"), "gi");

/** 빈칸에 정답을 넣어 포맷하고 같은 순번의 정답 자리를 다시 빈칸으로 바꾼다 */
export const formatTemplate = (template: string, answer: string, dialect: Dialect, width: number): string => {
  const [before] = template.split(BLANK);
  const filled = template.replace(BLANK, answer);
  const re = answerPattern(answer);
  const nth = [...(before + answer).matchAll(re)].length - 1;
  const formatted = formatSql(filled, dialect, width);
  const match = [...formatted.matchAll(answerPattern(answer))][nth];
  if (!match || match.index === undefined) throw new Error(`빈칸 위치를 찾지 못함: ${answer}`);
  let out = formatted.slice(0, match.index) + BLANK + formatted.slice(match.index + match[0].length);
  // 표준 SQL 포맷은 모르는 함수 이름 뒤에 공백을 넣는다. 함수 이름 빈칸이면 괄호에 붙인다(MySQL 은 공백이 있으면 내장 함수로 보지 않는다)
  if (template.includes(`${BLANK}(`)) out = out.replace(`${BLANK} (`, `${BLANK}(`);
  const squash = (x: string) => x.replace(/\s+/g, "").toLowerCase();
  if (squash(out.replace(BLANK, answer)) !== squash(formatted)) throw new Error(`빈칸 복원 불일치: ${answer}`);
  return out;
};

const CARD_WIDTH = 44;
const PROBLEM_WIDTH = 80;

const main = () => {
  const check = process.argv.includes("--check");
  const changed: string[] = [];
  const failed: string[] = [];
  const write = (file: string, before: string, data: unknown) => {
    const after = JSON.stringify(data, null, 2) + "\n";
    if (after === before) return;
    changed.push(path.relative(process.cwd(), file));
    if (!check) writeFileSync(file, after);
  };

  const cardDir = path.join("content", "cards");
  for (const f of readdirSync(cardDir).filter((x) => x.endsWith(".json")).sort()) {
    const file = path.join(cardDir, f);
    const before = readFileSync(file, "utf-8");
    const deck = JSON.parse(before);
    for (const c of deck.cards) {
      try {
        c.template = formatTemplate(c.template, c.answers[0], c.dialect, CARD_WIDTH);
      } catch (e) {
        failed.push(`${c.id}: ${(e as Error).message.split("\n")[0]}`);
      }
    }
    write(file, before, deck);
  }

  const probDir = path.join("content", "problems");
  for (const group of readdirSync(probDir).sort()) {
    for (const f of readdirSync(path.join(probDir, group)).filter((x) => x.endsWith(".json")).sort()) {
      const file = path.join(probDir, group, f);
      const before = readFileSync(file, "utf-8");
      const p = JSON.parse(before);
      for (const key of ["solutions", "starterSql"] as const) {
        for (const d of Object.keys(p[key] ?? {})) {
          try {
            p[key][d] = formatSql(p[key][d], d as Dialect, PROBLEM_WIDTH);
          } catch (e) {
            failed.push(`${p.id} ${key}.${d}: ${(e as Error).message.split("\n")[0]}`);
          }
        }
      }
      for (const d of Object.keys(p.spot?.sql ?? {})) {
        try {
          p.spot.sql[d] = formatSql(p.spot.sql[d], d as Dialect, PROBLEM_WIDTH);
        } catch (e) {
          failed.push(`${p.id} spot.${d}: ${(e as Error).message.split("\n")[0]}`);
        }
      }
      for (const d of Object.keys(p.review?.sql ?? {})) {
        try {
          p.review.sql[d] = formatSql(p.review.sql[d], d as Dialect, PROBLEM_WIDTH);
        } catch (e) {
          failed.push(`${p.id} review.${d}: ${(e as Error).message.split("\n")[0]}`);
        }
      }
      write(file, before, p);
    }
  }

  console.log(changed.length ? `${check ? "바뀔" : "바꾼"} 파일 ${changed.length}개` : "바뀔 파일 없음");
  if (failed.length) console.log(`포맷 실패 ${failed.length}건 (원문 유지)\n${failed.join("\n")}`);
  process.exit((check && changed.length) || failed.length ? 1 : 0);
};

if (process.argv[1]?.endsWith("format-sql.ts")) main();
