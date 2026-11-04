"use client";
import { Check, Lightbulb, X } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { DIALECT_LABEL, type Card, type SyntaxRef } from "@/lib/content/types";
import { isCorrect, splitTemplate, type DialectFilter, type Outcome } from "@/lib/daily/srs";

export interface SessionCard extends Card {
  deckTitle: string;
  /** 처음 보는 카드 */
  fresh: boolean;
}

export interface SessionResult {
  cardId: string;
  outcome: Outcome;
}

interface Props {
  queue: SessionCard[];
  syntax: Record<string, SyntaxRef>;
  /** 방언을 하나로 골랐으면 문법도 공통과 그 방언 형태만 보인다 */
  dialectFilter: DialectFilter;
  onAnswer: (card: SessionCard, outcome: Outcome, firstTry: boolean) => void;
  onExit: (results: SessionResult[]) => void;
}

const DIALECT_TONE: Record<string, string> = {
  postgres: "text-dialect-pg",
  bigquery: "text-dialect-bq",
  mysql: "text-dialect-my",
  common: "text-muted",
};

/** 카드 방언 형태를 먼저, 다음 공통, 나머지 방언 순 */
const formsFor = (ref: SyntaxRef, cardDialect: Card["dialect"], filter: DialectFilter) => {
  const rank = (d: string) => (d === cardDialect ? 0 : d === "common" ? 1 : 2);
  return ref.forms.filter((f) => filter === "all" || f.dialect === "common" || f.dialect === filter || f.dialect === cardDialect).sort((a, b) => rank(a.dialect) - rank(b.dialect));
};

export function CardSession({ queue: initial, syntax, dialectFilter, onAnswer, onExit }: Props) {
  const [queue, setQueue] = useState(initial);
  const [pos, setPos] = useState(0);
  const [input, setInput] = useState("");
  const [hint, setHint] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [results, setResults] = useState<SessionResult[]>([]);
  const [retried, setRetried] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  const card = queue[pos];
  const isRetry = card ? queue.findIndex((c) => c.id === card.id) < pos : false;

  useEffect(() => {
    // 결과 아래 해설·문법을 읽도록 다음 버튼으로 화면을 내리지 않는다
    if (outcome) nextRef.current?.focus({ preventScroll: true });
    else inputRef.current?.focus();
  }, [outcome, pos]);

  if (!card) return null;
  const [before, after] = splitTemplate(card.template);
  const answer = card.answers[0];
  const refs = card.syntax.map((id) => syntax[id]).filter((r): r is SyntaxRef => r !== undefined);

  const submit = (giveUp = false) => {
    if (outcome) return;
    if (!giveUp && !input.trim()) return;
    const ok = !giveUp && isCorrect(card, input);
    const result: Outcome = ok ? (hint ? "hinted" : "correct") : "wrong";
    const firstTry = !results.some((r) => r.cardId === card.id);
    setOutcome(result);
    onAnswer(card, result, firstTry);
    if (firstTry) setResults((prev) => [...prev, { cardId: card.id, outcome: result }]);
    if (result === "wrong" && !retried.has(card.id)) {
      setRetried((prev) => new Set(prev).add(card.id));
      setQueue((prev) => [...prev, card]);
    }
  };

  const next = () => {
    if (pos + 1 >= queue.length) {
      onExit(results);
      return;
    }
    setPos(pos + 1);
    setInput("");
    setHint(false);
    setOutcome(null);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  const done = pos + (outcome ? 1 : 0);
  // 입력 길이에 맞춰 늘고 준다. 커서 자리 1칸, 빈 상태 최소 4칸. 패딩(px-1.5)과 테두리(1px)를 더한다
  const blankWidth = `calc(${Math.max(input.length + 1, 4)}ch + 0.75rem + 2px)`;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pt-4 pb-6">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => onExit(results)} aria-label="그만하기" className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-fg/10 hover:text-fg">
          <X size={18} />
        </button>
        <div className="relative h-5 flex-1 overflow-hidden rounded-full bg-fg/10" role="progressbar" aria-valuemin={0} aria-valuemax={queue.length} aria-valuenow={done}>
          <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${(done / queue.length) * 100}%` }} />
          <span className="absolute inset-0 flex items-center justify-center font-mono text-[11px] font-semibold tabular-nums">
            {done}/{queue.length}
          </span>
        </div>
      </div>

      <article className="mt-5 overflow-hidden rounded-card border border-line bg-surface">
        <div className="bg-fg/[0.04] px-5 pt-4 pb-5">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted">{card.deckTitle}</span>
            <span className={`font-medium ${DIALECT_TONE[card.dialect]}`}>{card.dialect === "common" ? "공통" : DIALECT_LABEL[card.dialect]}</span>
            {card.level === "applied" && <span className="text-muted">응용</span>}
            <span className="ml-auto">
              {outcome === "wrong" && !isRetry ? (
                <span className="rounded-full bg-warn/15 px-2 py-0.5 font-medium text-warn">5분 뒤 복습</span>
              ) : isRetry ? (
                <span className="rounded-full bg-fg/10 px-2 py-0.5 text-muted">다시</span>
              ) : card.fresh ? (
                <span className="rounded-full bg-accent/15 px-2 py-0.5 font-medium text-accent">새 카드</span>
              ) : (
                <span className="rounded-full bg-fg/10 px-2 py-0.5 text-muted">복습</span>
              )}
            </span>
          </div>
          <p className="mt-3 text-[17px] leading-relaxed font-medium">{card.prompt}</p>
          {hint && !outcome && (
            <p className="mt-3 flex gap-2 rounded-xl bg-fail/10 px-3 py-2 text-[13.5px] leading-relaxed text-fg/90">
              <Lightbulb size={15} className="mt-0.5 shrink-0 text-warn" aria-hidden="true" />
              {card.hint}
            </p>
          )}
        </div>
        <div className="border-t border-line px-4 py-5 sm:px-5">
          <pre className="font-mono text-[13px] leading-[1.9] whitespace-pre-wrap break-words sm:text-[14px]">
            {before}
            {outcome ? (
              <span className={`rounded-md px-1.5 py-0.5 ${outcome === "wrong" ? "bg-pass/15 text-pass" : "bg-pass/20 text-pass"}`}>{answer}</span>
            ) : (
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKey}
                aria-label="빈칸"
                autoCapitalize="off"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                enterKeyHint="done"
                style={{ width: blankWidth }}
                className="mx-0.5 max-w-full rounded-md border border-accent/50 bg-accent/10 px-1.5 py-0.5 font-mono text-[16px] text-fg outline-none transition-[width] duration-100 ease-out focus:border-accent motion-reduce:transition-none sm:text-[14px]"
              />
            )}
            {after}
          </pre>
          {outcome === "wrong" && input.trim() && (
            <p className="mt-2 font-mono text-[13px] text-fail line-through decoration-fail/60">{input.trim()}</p>
          )}
        </div>
        {outcome && (
          <div className="border-t border-line px-5 py-4">
            <p className={`flex items-center gap-1.5 text-sm font-semibold ${outcome === "wrong" ? "text-fail" : "text-pass"}`}>
              {outcome === "wrong" ? <X size={15} aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}
              {outcome === "wrong" ? "오답" : outcome === "hinted" ? "정답 (힌트 사용)" : "정답"}
            </p>
            <p className="mt-2 text-[13.5px] leading-relaxed text-fg/85">{card.explanation}</p>
            {card.result && (
              <div className="mt-3 overflow-x-auto rounded-lg border border-line">
                <table className="w-full font-mono text-[12px]">
                  <thead className="bg-fg/5 text-muted">
                    <tr>
                      {card.result.columns.map((c) => (
                        <th key={c} className="px-2.5 py-1.5 text-left font-medium">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {card.result.rows.map((r, i) => (
                      <tr key={i} className="border-t border-line">
                        {r.map((v, j) => (
                          <td key={j} className="px-2.5 py-1.5 whitespace-nowrap">
                            {v === null ? <span className="text-muted">NULL</span> : String(v)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
        {outcome && refs.length > 0 && (
          <section aria-label="문법" className="border-t border-line px-5 py-4">
            <h3 className="text-xs font-semibold text-muted">문법</h3>
            {refs.map((ref) => (
              <div key={ref.id} className="mt-3">
                <p className="font-mono text-[13.5px] font-semibold">{ref.title}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-fg/80">{ref.summary}</p>
                {formsFor(ref, card.dialect, dialectFilter).map((f, i) => (
                  <div key={i} className="mt-2.5">
                    <p className={`text-[11px] font-medium ${DIALECT_TONE[f.dialect]}`}>{f.dialect === "common" ? "공통" : DIALECT_LABEL[f.dialect]}</p>
                    <pre className="mt-1 rounded-lg bg-fg/[0.05] px-3 py-2 font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap break-words">{f.code}</pre>
                    {f.note && <p className="mt-1 text-[12.5px] leading-relaxed text-fg/70">{f.note}</p>}
                  </div>
                ))}
              </div>
            ))}
          </section>
        )}
      </article>

      <div className="mt-auto pt-6">
        {outcome ? (
          <button ref={nextRef} type="button" onClick={next} className="h-12 w-full rounded-xl bg-accent text-[15px] font-semibold text-white hover:bg-accent/85">
            {pos + 1 >= queue.length ? "결과 보기" : "다음 문제"}
          </button>
        ) : (
          <div className="flex gap-2">
            <button type="button" onClick={() => setHint(true)} disabled={hint} className="inline-flex h-12 items-center gap-1.5 rounded-xl bg-fg/10 px-4 text-sm font-medium hover:bg-fg/15 disabled:opacity-50">
              <Lightbulb size={16} aria-hidden="true" />
              힌트
            </button>
            <button type="button" onClick={() => submit(true)} className="h-12 rounded-xl bg-fg/10 px-4 text-sm font-medium text-muted hover:bg-fg/15">
              모르겠어요
            </button>
            <button type="button" onClick={() => submit()} disabled={!input.trim()} className="h-12 flex-1 rounded-xl bg-accent text-[15px] font-semibold text-white hover:bg-accent/85 disabled:opacity-45">
              확인
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
