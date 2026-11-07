"use client";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Selecky } from "@/components/selecky/Selecky";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/icons";
import { Note } from "@/components/ui/Note";
import { ResultSheet } from "@/components/ui/ResultSheet";
import { useHideTabBar } from "@/components/shell/tabbar";
import { DIALECT_LABEL, type Card, type SyntaxRef } from "@/lib/content/types";
import { answerDistance, FIRST_LETTER_MIN_LEN, intervalLabel, isCorrect, MASTERED_BOX, maskAnswers, schedule, type CardState, type DialectFilter, type Outcome } from "@/lib/daily/srs";
import { Blank, CardCode } from "./CardCode";
import { ReviewLadder } from "./ReviewLadder";
import "./daily.css";

export interface SessionCard extends Card {
  deckTitle: string;
  /** 처음 보는 카드 */
  fresh: boolean;
  /** 세션 시작 때의 복습 상태 */
  prev?: CardState;
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
  /** 카드가 끝날 때 한 번만 부른다 */
  onAnswer: (card: SessionCard, outcome: Outcome, firstTry: boolean) => void;
  onExit: (results: SessionResult[]) => void;
}

interface Finish {
  outcome: Outcome;
  /** 정답 보기로 끝냈다 */
  gaveUp: boolean;
  /** 이번 풀이 뒤 복습 상자 */
  box: number;
  /** 이번 풀이 전 상자. 처음 보는 카드는 -1 */
  prevBox: number;
}

const KIND_LABEL = { function: "함수 이해", context: "맥락 이해" } as const;

const DIALECT_TONE: Record<string, string> = {
  postgres: "text-dialect-pg",
  bigquery: "text-dialect-bq",
  mysql: "text-dialect-my",
  common: "text-muted",
};

/** 카드 방언 형태를 먼저, 다음 공통, 나머지 방언 순. MySQL 형식은 화면에 내지 않는다 */
const formsFor = (ref: SyntaxRef, cardDialect: Card["dialect"], filter: DialectFilter) => {
  const rank = (d: string) => (d === cardDialect ? 0 : d === "common" ? 1 : 2);
  return ref.forms
    .filter((f) => f.dialect !== "mysql" && (filter === "all" || f.dialect === "common" || f.dialect === filter || f.dialect === cardDialect))
    .sort((a, b) => rank(a.dialect) - rank(b.dialect));
};

const CARD_NORMAL = "bg-surface shadow-[inset_0_0_0_1.5px_var(--color-line),0_4px_0_var(--color-line)] dark:shadow-[inset_0_0_0_1px_var(--color-line)]";
const CARD_WRONG =
  "bg-fail-soft shadow-[inset_0_0_0_1.5px_color-mix(in_srgb,var(--color-fail)_40%,transparent),0_4px_0_color-mix(in_srgb,var(--color-fail)_25%,transparent)] dark:shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-fail)_45%,transparent)]";

export function CardSession({ queue: initial, syntax, dialectFilter, onAnswer, onExit }: Props) {
  useHideTabBar();
  const [queue, setQueue] = useState(initial);
  const [pos, setPos] = useState(0);
  const [input, setInput] = useState("");
  /** 0 없음, 1 앞글자, 2 추가 힌트(말 설명·함수 뜻). 정답이 짧으면 앞글자를 건너뛴다 */
  const [hintStep, setHintStep] = useState<0 | 1 | 2>(0);
  const [focused, setFocused] = useState(false);
  /** 지금 입력이 오답으로 표시된 상태. 입력을 고치면 풀린다 */
  const [marked, setMarked] = useState(false);
  const [wrongCount, setWrongCount] = useState(0);
  const [lastWrong, setLastWrong] = useState<{ text: string; near: number | null } | null>(null);
  const [finish, setFinish] = useState<Finish | null>(null);
  const [results, setResults] = useState<SessionResult[]>([]);
  const [retried, setRetried] = useState<Set<string>>(new Set());
  const states = useRef(new Map<string, CardState | undefined>());
  const inputRef = useRef<HTMLInputElement>(null);
  const actionRef = useRef<HTMLSpanElement>(null);

  const card = queue[pos];
  const isRetry = card ? queue.findIndex((c) => c.id === card.id) < pos : false;

  useEffect(() => {
    // 결과 아래 해설·문법을 읽도록 계속 버튼으로 화면을 내리지 않는다
    if (finish) actionRef.current?.querySelector("button")?.focus({ preventScroll: true });
    else inputRef.current?.focus();
  }, [finish, pos]);

  if (!card) return null;
  const answer = card.answers[0];
  const hint = hintStep > 0;
  const canFirstLetter = answer.length >= FIRST_LETTER_MIN_LEN;
  const refs = card.syntax.map((id) => syntax[id]).filter((r): r is SyntaxRef => r !== undefined);

  const complete = (outcome: Outcome, gaveUp: boolean) => {
    if (finish) return;
    const prev = states.current.has(card.id) ? states.current.get(card.id) : card.prev;
    const after = schedule(prev, outcome, Date.now());
    states.current.set(card.id, after);
    const firstTry = !results.some((r) => r.cardId === card.id);
    setFinish({ outcome, gaveUp, box: after.box, prevBox: prev?.box ?? -1 });
    setMarked(false);
    onAnswer(card, outcome, firstTry);
    if (firstTry) setResults((r) => [...r, { cardId: card.id, outcome }]);
    if (outcome === "wrong" && !retried.has(card.id)) {
      setRetried((r) => new Set(r).add(card.id));
      setQueue((q) => [...q, card]);
    }
  };

  const submit = () => {
    if (finish || !input.trim()) return;
    if (isCorrect(card, input)) {
      complete(wrongCount > 0 ? "wrong" : hint ? "hinted" : "correct", false);
      return;
    }
    const distance = answerDistance(card, input);
    setWrongCount((n) => n + 1);
    setLastWrong({ text: input.trim(), near: distance <= 2 ? distance : null });
    setMarked(true);
    inputRef.current?.focus();
  };

  /** 오답을 낸 카드에서 나가면 정답 보기와 같이 wrong 으로 남긴다. 오답이 없었으면 기록하지 않는다 */
  const leave = () => {
    if (finish || wrongCount === 0) {
      onExit(results);
      return;
    }
    const firstTry = !results.some((r) => r.cardId === card.id);
    onAnswer(card, "wrong", firstTry);
    onExit(firstTry ? [...results, { cardId: card.id, outcome: "wrong" }] : results);
  };

  const next = () => {
    if (pos + 1 >= queue.length) {
      onExit(results);
      return;
    }
    setPos(pos + 1);
    setInput("");
    setHintStep(0);
    setMarked(false);
    setWrongCount(0);
    setLastWrong(null);
    setFinish(null);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  const done = pos + (finish ? 1 : 0);
  const passTone = finish ? finish.outcome !== "wrong" || !finish.gaveUp : true;
  const chip = finish ? (
    <Chip tone="accent" size="sm">
      <Icon name="clock" size={14} />
      {intervalLabel(finish.box)} 뒤 복습
    </Chip>
  ) : isRetry ? (
    <Chip size="sm">다시</Chip>
  ) : card.fresh || !card.prev ? (
    <Chip tone="accent" size="sm">
      새 카드
    </Chip>
  ) : (
    <Chip tone="accent" size="sm">
      <Icon name="clock" size={14} />
      {intervalLabel(card.prev.box)} 만에 복습
    </Chip>
  );

  const blankState = finish ? "right" : marked ? "wrong" : "idle";
  const sub = !finish ? "" : passTone ? `${intervalLabel(finish.box)} 뒤 복습` : lastWrong ? `정답 ${answer} · 입력 ${lastWrong.text}` : `정답 ${answer}`;
  const sub2 = !finish
    ? ""
    : !passTone
      ? "5분 뒤 다시 나옵니다"
      : finish.outcome === "wrong"
        ? "처음 단계로 돌아갑니다"
        : finish.outcome === "hinted"
          ? "힌트를 쓴 정답"
          : finish.box >= MASTERED_BOX && finish.prevBox < MASTERED_BOX
            ? "익힌 카드로 넘어갑니다"
            : "";

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pt-3 pb-6 lg:pt-8">
      <div className="flex h-14 items-center gap-3.5 lg:h-12">
        <button type="button" onClick={leave} aria-label="그만하기" className="-ml-1 inline-flex h-10 w-10 items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-fg">
          <Icon name="x" size={26} />
        </button>
        <div className="relative h-4 flex-1 overflow-hidden rounded-[9px] bg-surface-3" role="progressbar" aria-label="오늘의 카드 진행" aria-valuemin={0} aria-valuemax={queue.length} aria-valuenow={done}>
          <div className="absolute inset-y-0 left-0 rounded-[9px] bg-pass transition-[width] duration-300" style={{ width: `${(done / queue.length) * 100}%` }}>
            <span className="absolute inset-x-2 top-1 h-1 rounded-sm bg-white/35" />
          </div>
        </div>
        <span className="min-w-7 text-right font-mono text-[13px] leading-none font-bold text-muted tabular-nums">
          {done}/{queue.length}
        </span>
      </div>

      <article className={`mt-2 rounded-[22px] px-3.5 pt-4 pb-3.5 transition-colors ${marked ? CARD_WRONG : CARD_NORMAL}`}>
        <div className="mx-0.5 flex h-[26px] items-center gap-2 text-[13px] font-semibold text-muted">
          <span className="truncate">{card.deckTitle}</span>
          <span className={`shrink-0 ${DIALECT_TONE[card.dialect]}`}>{card.dialect === "common" ? "공통" : DIALECT_LABEL[card.dialect]}</span>
          {card.kind && <span className="shrink-0">{KIND_LABEL[card.kind]}</span>}
          {card.level === "applied" && <span className="shrink-0">응용</span>}
          <span className="ml-auto shrink-0">{chip}</span>
        </div>
        <h2 className="mx-0.5 mt-2.5 mb-3.5 text-[21px] leading-[1.38] font-extrabold tracking-[-0.035em]">{card.prompt}</h2>
        {hint && !finish && (
          <Note className="mb-3 flex gap-2 !py-2.5 text-[13.5px]">
            <Icon name="bulb" size={16} className="mt-0.5 shrink-0" />
            <div className="min-w-0">
              {canFirstLetter && (
                <p>
                  첫 글자 <b data-first-letter="" className="font-mono">{answer[0]}</b>
                </p>
              )}
              {hintStep === 2 && (
                <>
                  <p className={canFirstLetter ? "mt-1.5" : ""}>{card.hint}</p>
                  {card.hintMore ? (
                    <p className="mt-1.5">{card.hintMore}</p>
                  ) : (
                    refs.map((ref) => (
                      <p key={ref.id} className="mt-1.5 text-[13px] leading-snug">
                        <b>{maskAnswers(ref.title, card.answers)}</b> {maskAnswers(ref.summary, card.answers)}
                      </p>
                    ))
                  )}
                </>
              )}
            </div>
          </Note>
        )}
        <div className="relative rounded-[14px] bg-code-bg p-3 shadow-[inset_0_0_0_1px_var(--color-line)]">
          <CardCode template={card.template} blank={<Blank value={finish?.gaveUp ? answer : input} length={answer.length} state={blankState} focused={focused} />} />
          {!finish && (
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                if (marked) setMarked(false);
              }}
              onKeyDown={onKey}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              aria-label="빈칸"
              autoCapitalize="off"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="done"
              className="absolute inset-0 h-full w-full cursor-text bg-transparent text-[16px] opacity-0 outline-none"
            />
          )}
        </div>
        {marked && lastWrong && (
          <p role="alert" className="mx-0.5 mt-3 flex items-center gap-1.5 text-[13.5px] font-semibold text-fail-ink">
            <Icon name="xcircle" size={17} className="shrink-0 text-fail" />
            {lastWrong.near !== null ? (
              <span>
                <code className="font-mono">{lastWrong.text}</code> - 정답과 {lastWrong.near}글자 달라요
              </span>
            ) : (
              "오답이에요"
            )}
          </p>
        )}
      </article>

      {!finish && (
        <div className="mt-auto flex gap-2 pt-6">
          {hintStep === 2 ? (
            <Button tone="ghost" size="sm" onClick={() => complete("wrong", true)}>
              정답 보기
            </Button>
          ) : hintStep === 1 ? (
            <Button tone="ghost" size="sm" onClick={() => setHintStep(2)}>
              <Icon name="bulb" size={18} />
              추가 힌트
            </Button>
          ) : (
            <Button tone="ghost" size="sm" onClick={() => setHintStep(canFirstLetter ? 1 : 2)}>
              <Icon name="bulb" size={18} />
              힌트
            </Button>
          )}
          <Button size="sm" className="flex-1" onClick={submit} disabled={!input.trim()}>
            확인
          </Button>
        </div>
      )}

      {finish && (
        <ResultSheet
          scrim
          tone={passTone ? "pass" : "fail"}
          className="max-h-[88dvh] overflow-y-auto"
          action={
            <span ref={actionRef} className="contents">
              <Button full tone={passTone ? "pass" : "fail"} onClick={next}>
                {pos + 1 >= queue.length ? "결과 보기" : "계속"}
              </Button>
            </span>
          }
        >
          <div className="flex items-center gap-4">
            <Selecky key={`${card.id}:${pos}`} motion={passTone ? "C2" : "C3"} size={88} className="shrink-0" />
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-2xl font-extrabold tracking-[-0.03em] text-[var(--ci)]">
                <Icon name={passTone ? "ccircle" : "xcircle"} size={26} />
                {passTone ? "정답" : "오답"}
              </p>
              <p className="mt-0.5 text-base font-extrabold break-words text-[var(--ci)]">{sub}</p>
              {sub2 && <p className="mt-px text-[13px] font-semibold text-[color-mix(in_srgb,var(--ci)_72%,var(--color-fg))]">{sub2}</p>}
            </div>
          </div>
          <div className="my-3.5">
            <ReviewLadder box={finish.box} tone={passTone ? "pass" : "fail"} />
          </div>
          <Note>{card.explanation}</Note>
          {card.result && (
            <div className="mt-3 overflow-x-auto rounded-2xl bg-surface/70 dark:bg-bg/55">
              <table className="w-full font-mono text-[12px]">
                <thead className="text-muted">
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
          {refs.length > 0 && (
            <section aria-label="문법" className="mt-3 rounded-2xl bg-surface/70 px-3.5 py-3 dark:bg-bg/55">
              {refs.map((ref, ri) => (
                <div key={ref.id} className={ri > 0 ? "mt-3 border-t border-dashed border-line-2 pt-3" : ""}>
                  <p className="flex items-baseline gap-2">
                    <span className="text-[12.5px] font-bold text-muted">문법</span>
                    <b className="text-[14.5px] font-extrabold">{ref.title}</b>
                  </p>
                  <p className="mt-1 text-[12.5px] leading-snug text-muted">{ref.summary}</p>
                  {formsFor(ref, card.dialect, dialectFilter).map((f, i) => (
                    <div key={i} className={`grid grid-cols-[80px_1fr] items-baseline gap-x-2 gap-y-0.5 py-1.5 ${i === 0 ? "mt-1" : "border-t border-dashed border-line-2"}`}>
                      <span className={`text-[12.5px] font-bold ${DIALECT_TONE[f.dialect]}`}>{f.dialect === "common" ? "공통" : DIALECT_LABEL[f.dialect]}</span>
                      <code className={`font-mono text-[13px] leading-normal break-words whitespace-pre-wrap text-code-fg ${f.dialect === card.dialect ? "font-bold" : ""}`}>{f.code}</code>
                      {f.note && <p className="col-start-2 text-xs leading-snug font-medium text-muted">{f.note}</p>}
                    </div>
                  ))}
                </div>
              ))}
            </section>
          )}
        </ResultSheet>
      )}
    </div>
  );
}
