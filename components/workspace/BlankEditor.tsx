"use client";
import { Fragment, useState } from "react";
import { joinBlanks, type BlankSplit } from "@/lib/grading/blanks";

/**
 * 정답 쿼리의 일부를 가린 빈칸 채우기. 모든 빈칸을 채우면 이어 붙인 쿼리를, 아니면 빈 문자열을 onChange 로 올린다.
 *
 * Args:
 *   split: splitBlanks 결과.
 *   onChange: 이어 붙인 쿼리.
 *   onRun: Cmd/Ctrl+Enter.
 */
export function BlankEditor({ split, onChange, onRun }: { split: BlankSplit; onChange: (sql: string) => void; onRun: () => void }) {
  const [values, setValues] = useState<string[]>(() => split.answers.map(() => ""));
  const set = (i: number, v: string) => {
    const next = values.map((x, j) => (j === i ? v : x));
    setValues(next);
    onChange(next.every((x) => x.trim()) ? joinBlanks(split.parts, next) : "");
  };
  return (
    <pre className="h-full overflow-auto p-4 font-mono text-[13.5px] leading-[2.1] whitespace-pre-wrap text-fg">
      {split.parts.map((part, i) => (
        <Fragment key={i}>
          {part}
          {i < split.answers.length && (
            <input
              id={`blank-${i}`}
              value={values[i]}
              onChange={(e) => set(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onRun();
              }}
              aria-label={`빈칸 ${i + 1}`}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              style={{ width: `${Math.max(split.answers[i].length, 4) + 2}ch` }}
              className="mx-0.5 h-7 rounded-md bg-accent-soft px-1.5 font-mono text-[13.5px] text-accent-ink ring-1 ring-accent/40 outline-none ring-inset focus:ring-2 focus:ring-accent"
            />
          )}
        </Fragment>
      ))}
    </pre>
  );
}
