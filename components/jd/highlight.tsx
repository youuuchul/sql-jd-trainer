import type { ReactNode } from "react";

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\/-]/g, "\\$&");

/** 키워드 한 개가 본문에서 공백·대소문자와 무관하게 잡히도록(분석과 같은 기준) 글자 사이에 공백 허용을 둔다. */
const toPattern = (keyword: string) =>
  [...keyword.replace(/\s+/g, "")]
    .map(escape)
    .join("\\s*");

/** 공고 본문에서 찾은 키워드에 밑줄을 긋는다. */
export function HighlightedText({ text, keywords }: { text: string; keywords: string[] }) {
  const unique = [...new Set(keywords)].filter(Boolean).sort((a, b) => b.length - a.length);
  if (!unique.length) return <>{text}</>;
  const re = new RegExp(`(${unique.map(toPattern).join("|")})`, "gi");
  const parts: ReactNode[] = text.split(re).map((part, i) =>
    i % 2 === 1 ? (
      <mark key={i} className="bg-transparent font-bold text-fg underline decoration-accent decoration-2 underline-offset-4">
        {part}
      </mark>
    ) : (
      part
    ),
  );
  return <>{parts}</>;
}
