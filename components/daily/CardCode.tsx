import { Fragment, type ReactNode } from "react";

const BLANK = "___";
const SENTINEL = "\u0000";

const KEYWORDS = new Set(
  (
    "SELECT FROM WHERE GROUP BY ORDER HAVING LIMIT OFFSET WITH AS ON JOIN LEFT RIGHT FULL INNER OUTER CROSS UNION ALL DISTINCT CASE WHEN THEN ELSE END AND OR NOT IN IS NULL LIKE ILIKE BETWEEN EXISTS OVER PARTITION ROWS RANGE UNBOUNDED PRECEDING FOLLOWING CURRENT ROW ASC DESC INTERVAL DATE TIMESTAMP INTEGER INT BIGINT TEXT VARCHAR NUMERIC DECIMAL FLOAT64 INT64 STRING BOOL BOOLEAN USING EXCEPT INTERSECT VALUES FILTER WINDOW NULLS FIRST LAST TRUE FALSE UNNEST LATERAL TABLE"
  ).split(" "),
);

type Kind = "k" | "f" | "s" | "n" | "c" | "t";
interface Token {
  kind: Kind;
  text: string;
}

const TOKEN_RE = /(--[^\n]*)|('(?:[^'\n]|'')*'?)|("[^"\n]*"?)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][A-Za-z0-9_]*)|(\s+)|([^\sA-Za-z0-9_'"-]|-)/g;

/** 템플릿 한 줄을 키워드·함수·문자열·숫자·주석으로 가른다. 정규식은 한 글자도 버리지 않아 이어 붙이면 원문이 된다 */
const tokenize = (line: string): Token[] => {
  const out: Token[] = [];
  TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN_RE.exec(line))) {
    const [text, comment, sq, dq, num, word] = m;
    if (comment) out.push({ kind: "c", text });
    else if (sq || dq) out.push({ kind: "s", text });
    else if (num) out.push({ kind: "n", text });
    else if (word) {
      const next = line.slice(TOKEN_RE.lastIndex).trimStart()[0];
      out.push({ kind: KEYWORDS.has(word.toUpperCase()) ? "k" : next === "(" ? "f" : "t", text });
    } else out.push({ kind: "t", text });
  }
  return out;
};

const KIND_CLASS: Record<Kind, string> = {
  k: "text-syntax-keyword font-semibold dark:font-normal",
  f: "text-syntax-function",
  s: "text-syntax-string",
  n: "text-syntax-number",
  c: "text-syntax-comment",
  t: "",
};

export type BlankState = "idle" | "wrong" | "right";

/** 글자 칸. 정답 글자 수만큼 처음부터 보이고, 더 길게 쓰면 칸이 늘어난다. 칸 단위로 줄이 바뀐다 */
export function Blank({ value, length, state, focused }: { value: string; length: number; state: BlankState; focused: boolean }) {
  const count = state === "idle" ? Math.max(length, value.length + (focused ? 1 : 0)) : Math.max(length, value.length);
  const chars = Array.from({ length: count }, (_, i) => value[i] ?? "");
  const cursor = state === "idle" && focused ? value.length : -1;
  const tone =
    state === "right"
      ? "bg-pass-soft text-pass-ink shadow-[inset_0_-2px_0_var(--color-pass)]"
      : state === "wrong"
        ? "bg-fail-soft text-fail-ink shadow-[inset_0_-2px_0_var(--color-fail)]"
        : "bg-slot text-fg shadow-[inset_0_-2px_0_var(--color-slot-line)]";
  return (
    <span data-blank={state} className="mx-px whitespace-normal indent-0">
      {chars.map((ch, i) => (
        <i
          key={i}
          data-slot=""
          className={`relative mr-0.5 inline-grid h-6 w-[15px] place-items-center rounded-[5px] align-[-6px] text-[14px] leading-none font-bold not-italic last:mr-0 ${
            state === "wrong" && ch === "" ? "bg-transparent text-fail-ink shadow-[inset_0_0_0_1.5px_color-mix(in_srgb,var(--color-fail)_45%,transparent)]" : tone
          } ${i === cursor ? "shadow-[inset_0_0_0_2px_var(--color-accent)]!" : ""}`}
        >
          {ch === " " ? " " : ch}
          {i === cursor && <span aria-hidden="true" className="dq-caret absolute h-[15px] w-0.5 rounded-[1px] bg-accent" />}
        </i>
      ))}
    </span>
  );
}

const pieces = (text: string, blank: ReactNode): ReactNode =>
  text.split(SENTINEL).map((part, i, all) => (
    <Fragment key={i}>
      {part}
      {i < all.length - 1 && blank}
    </Fragment>
  ));

/**
 * 카드 코드. template 의 ___ 자리에 blank 를 끼우고, 줄이 길어지면 들여쓰기를 유지한 채 줄을 바꾼다.
 * onPickLine 을 주면 줄을 눌러 고를 수 있고, missed 에 든 줄은 이미 골랐다가 틀린 줄로 흐리게 보인다
 */
export function CardCode({ template, blank, onPickLine, missed }: { template: string; blank: ReactNode; onPickLine?: (line: number) => void; missed?: number[] }) {
  const lines = template.replace(BLANK, SENTINEL).split("\n");
  return (
    <div className="font-mono text-[13.5px] leading-[1.9] text-code-fg">
      {lines.map((line, li) => {
        const indent = line.length - line.trimStart().length;
        return (
          <div
            key={li}
            role={onPickLine ? "button" : undefined}
            tabIndex={onPickLine ? 0 : undefined}
            data-line={onPickLine ? li : undefined}
            onClick={onPickLine ? () => onPickLine(li) : undefined}
            onKeyDown={onPickLine ? (e) => e.key === "Enter" && onPickLine(li) : undefined}
            className={`break-words whitespace-pre-wrap ${onPickLine ? "-mx-1.5 cursor-pointer rounded-md px-1.5 hover:bg-surface-2 focus-visible:bg-surface-2" : ""} ${missed?.includes(li) ? "opacity-40" : ""}`}
            style={{ paddingLeft: `calc(${indent}ch + ${onPickLine ? "0.375rem" : "0px"})`, textIndent: `-${indent}ch` }}
          >
            {tokenize(line).map((t, ti) => (
              <span key={ti} className={KIND_CLASS[t.kind]}>
                {pieces(t.text, blank)}
              </span>
            ))}
            {line === "" && " "}
          </div>
        );
      })}
    </div>
  );
}
