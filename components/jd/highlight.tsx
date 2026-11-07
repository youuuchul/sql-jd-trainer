import type { ReactNode } from "react";
import { findSqlRanges, splitLines } from "./sqlTerms";

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\/-]/g, "\\$&");

/** 키워드 한 개가 본문에서 공백·대소문자와 무관하게 잡히도록(분석과 같은 기준) 글자 사이에 공백 허용을 둔다. */
const toPattern = (keyword: string) =>
  [...keyword.replace(/\s+/g, "")]
    .map(escape)
    .join("\\s*");

type Range = [number, number];

/** 역량 키워드가 잡힌 위치. */
function keywordRanges(line: string, re: RegExp | null): Range[] {
  if (!re) return [];
  return [...line.matchAll(re)].map((m) => [m.index, m.index + m[0].length]);
}

/** 줄 하나를 SQL 용어(형광펜)와 역량 키워드(밑줄)로 나눠 그린다. 둘이 겹치면 두 표시를 함께 단다. */
function renderLine(line: string, kw: RegExp | null): ReactNode[] {
  const sql = findSqlRanges(line);
  const key = keywordRanges(line, kw);
  const cuts = new Set<number>([0, line.length]);
  for (const [s, e] of [...sql, ...key]) {
    cuts.add(s);
    cuts.add(e);
  }
  const points = [...cuts].sort((a, b) => a - b);
  const inside = (ranges: Range[], at: number) => ranges.some(([s, e]) => s <= at && at < e);
  const out: ReactNode[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [s, e] = [points[i], points[i + 1]];
    const part = line.slice(s, e);
    const isSql = inside(sql, s);
    const isKey = inside(key, s);
    if (!isSql && !isKey) {
      out.push(part);
      continue;
    }
    const cls = [
      isSql ? "rounded-[3px] bg-accent/[0.16] font-bold text-accent-ink" : "bg-transparent font-bold text-fg",
      isKey ? "underline decoration-accent decoration-2 underline-offset-4" : "",
    ].join(" ");
    out.push(
      <mark key={s} className={cls}>
        {part}
      </mark>,
    );
  }
  return out;
}

/**
 * 공고 본문을 줄 단위로 그린다.
 * SQL 용어가 있는 줄은 왼쪽 띠와 옅은 바탕, 용어는 형광펜, 역량 키워드는 밑줄.
 */
export function HighlightedBody({ text, keywords }: { text: string; keywords: string[] }) {
  const unique = [...new Set(keywords)].filter(Boolean).sort((a, b) => b.length - a.length);
  const kw = unique.length ? new RegExp(`(?:${unique.map(toPattern).join("|")})`, "gi") : null;
  return (
    <>
      {splitLines(text).map((line, i) => {
        const hot = findSqlRanges(line).length > 0;
        return (
          <div
            key={i}
            data-sql-line={hot ? "" : undefined}
            className={`-mx-2.5 min-h-[1.8em] whitespace-pre-wrap border-l-[3px] px-2.5 ${hot ? "rounded-r-[8px] border-accent bg-accent/[0.045]" : "border-transparent"}`}
          >
            {line ? renderLine(line, kw) : "​"}
          </div>
        );
      })}
    </>
  );
}
