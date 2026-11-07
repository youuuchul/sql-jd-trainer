import type { ReactNode } from "react";
import type { SchemaDef } from "@/lib/content/types";

/** 문장 끝(. ! ?)과 뒤따르는 공백에서 끊는다. 소수점(0.5)은 뒤에 공백이 없고, 말줄임표(...)는 끝으로 보지 않아 끊기지 않는다. */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?][)'"]?)(?<!\.\.[)'"]?)\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 규칙 글에서 코드 글꼴로 보일 이름: 이 스키마의 테이블·컬럼, 그리고 값 리터럴. */
export function identifierSet(schema: SchemaDef): Set<string> {
  const names = new Set<string>(["NULL", "true", "false"]);
  for (const t of schema.tables) {
    names.add(t.name);
    for (const c of t.columns) names.add(c.name);
  }
  return names;
}

const TOKEN = /'[^'\n]*'|[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*/g;
const CHIP = "rounded-[6px] bg-surface px-1 py-px font-mono text-[0.92em] leading-none font-semibold text-fg ring-1 ring-line ring-inset";
const VALUE_CHIP = "rounded-[6px] bg-accent-soft px-1 py-px font-mono text-[0.92em] leading-none font-semibold text-accent-ink";

/** 한 문장을 글과 코드 칩으로 나눈다. 따옴표 값은 값 칩, 사전에 있는 식별자는 이름 칩. */
export function renderInline(sentence: string, names: Set<string>): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of sentence.matchAll(TOKEN)) {
    const token = m[0];
    const isValue = token.startsWith("'");
    if (!isValue && !token.split(".").every((part) => names.has(part))) continue;
    if (m.index > last) out.push(sentence.slice(last, m.index));
    out.push(
      <code key={m.index} className={isValue ? VALUE_CHIP : CHIP}>
        {token}
      </code>,
    );
    last = m.index + token.length;
  }
  if (last < sentence.length) out.push(sentence.slice(last));
  return out;
}

/**
 * 규칙·지표 정의 글: 문장마다 줄을 나누고 이름·값을 코드 칩으로 보인다.
 *
 * Args:
 *   text: 원문.
 *   names: 코드 칩으로 보일 식별자 사전(identifierSet).
 *   lead: true 면 첫 문장(요지)을 굵게 쓴다. 문장이 하나뿐이면 굵게 하지 않는다.
 */
export function RuleText({ text, names, lead = false }: { text: string; names: Set<string>; lead?: boolean }) {
  const sentences = splitSentences(text);
  const bold = lead && sentences.length > 1;
  return (
    <div className="space-y-1.5">
      {sentences.map((s, i) => (
        <p key={i} className={bold && i === 0 ? "font-bold text-fg" : undefined}>
          {renderInline(s, names)}
        </p>
      ))}
    </div>
  );
}
