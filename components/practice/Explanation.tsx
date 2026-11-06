import type { ReactNode } from "react";
import { renderText } from "@/lib/text";

const LABELS = ["결과", "조회 기준", "인사이트"] as const;

/** 해설 본문. 앞 문단의 "결과: / 조회 기준: / 인사이트:" 줄은 라벨 행으로, 나머지는 문단으로 그린다. */
function ExplanationBody({ text }: { text: string }) {
  const [head, ...rest] = text.split(/\n{2,}/);
  const rows = head.split("\n").map((l) => {
    const label = LABELS.find((k) => l.startsWith(`${k}:`));
    return label ? { label, body: l.slice(label.length + 1).trim() } : null;
  });
  if (!rows.length || rows.some((r) => !r)) return <div className="space-y-2.5">{renderText(text)}</div>;
  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2.5 text-[13.5px] leading-[1.6]">
        {rows.map((r) => (
          <div key={r!.label} className="contents">
            <dt className="pt-px text-[12.5px] font-bold whitespace-nowrap text-muted">{r!.label}</dt>
            <dd className="font-medium text-fg-2">{r!.body}</dd>
          </div>
        ))}
      </dl>
      {rest.length > 0 && <div className="space-y-2.5 border-t border-line pt-3">{renderText(rest.join("\n\n"))}</div>}
    </div>
  );
}

export function Explanation({ text, children }: { text: string; children?: ReactNode }) {
  return (
    <section className="space-y-3.5 rounded-2xl bg-surface p-4 ring-1 ring-line ring-inset">
      <h2 className="text-[15px] font-extrabold tracking-[-0.02em]">해설</h2>
      <ExplanationBody text={text} />
      {children}
    </section>
  );
}

/** 방언별 정답 쿼리 블록 */
export function CodeBlock({ title, code }: { title?: string; code: string }) {
  return (
    <div>
      {title && <h3 className="mb-1.5 text-[12.5px] font-bold text-muted">{title}</h3>}
      <pre className="overflow-x-auto rounded-xl bg-code-bg p-3 font-mono text-[12.5px] leading-relaxed text-code-fg ring-1 ring-line ring-inset">{code}</pre>
    </div>
  );
}
