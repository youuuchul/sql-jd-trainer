import type { ReactNode } from "react";

/** 해설용 최소 렌더러. 빈 줄로 문단을 나누고 ```sql 블록을 코드로 보여준다. */
export const renderText = (text: string): ReactNode[] => {
  const blocks: ReactNode[] = [];
  const parts = text.split(/```(?:sql)?\n([\s\S]*?)```/g);
  parts.forEach((part, i) => {
    if (i % 2 === 1) {
      blocks.push(
        <pre key={i} className="overflow-x-auto rounded-xl border border-line bg-bg p-3 font-mono text-[12.5px] leading-relaxed">
          {part.trimEnd()}
        </pre>,
      );
      return;
    }
    part
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean)
      .forEach((p, j) => {
        const lines = p.split("\n");
        blocks.push(
          <p key={`${i}-${j}`} className="text-[13.5px] leading-relaxed text-fg/85">
            {lines.map((line, k) => (
              <span key={k}>
                {line}
                {k < lines.length - 1 && <br />}
              </span>
            ))}
          </p>,
        );
      });
  });
  return blocks;
};
