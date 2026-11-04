"use client";
import { Flame } from "lucide-react";
import { useMemo, useState } from "react";
import { SegmentedControl } from "@/components/ui-lab/components/segmented-control/SegmentedControl";
import { DIALECT_LABEL, DIALECTS, type CardDeck } from "@/lib/content/types";
import { buildQueue, dayKey, MASTERED_BOX, matchesDialect, streak, type DialectFilter } from "@/lib/daily/srs";
import { useDailyStore, useNow } from "@/lib/daily/store";
import { CardSession, type SessionCard, type SessionResult } from "./CardSession";
import { PushToggle } from "./PushToggle";

const GOALS = [5, 10, 20, 30] as const;
const DIALECT_OPTIONS: { value: DialectFilter; label: string }[] = [{ value: "all", label: "전체" }, ...DIALECTS.map((d) => ({ value: d, label: d === "postgres" ? "Postgres" : DIALECT_LABEL[d] }))];

type View = { kind: "home" } | { kind: "session"; queue: SessionCard[] } | { kind: "summary"; results: SessionResult[] };

export function DailyApp({ decks }: { decks: CardDeck[] }) {
  const { store, record, updateSettings } = useDailyStore();
  const [view, setView] = useState<View>({ kind: "home" });
  const [now, refreshNow] = useNow();
  const { goal, dialect } = store.settings;

  const cards = useMemo(() => decks.flatMap((d) => d.cards.map((c) => ({ ...c, deckTitle: d.title }))), [decks]);
  const today = store.days[dayKey(now)] ?? { answered: 0, correct: 0 };
  const completed = useMemo(() => new Set(Object.entries(store.days).filter(([, d]) => d.answered >= goal).map(([k]) => k)), [store.days, goal]);
  const pool = cards.filter((c) => matchesDialect(c, dialect));
  const dueCount = pool.filter((c) => store.cards[c.id] && store.cards[c.id].due <= now).length;
  const freshCount = pool.filter((c) => !store.cards[c.id]).length;
  const remaining = Math.max(goal - today.answered, 0);

  const start = () => {
    const t = Date.now();
    const size = remaining || goal;
    const queue = buildQueue(cards, store.cards, { now: t, size, filter: dialect, seedText: `${dayKey(t)}:${today.answered}` }).map((c) => ({ ...c, fresh: !store.cards[c.id] }));
    if (queue.length) setView({ kind: "session", queue });
  };

  if (view.kind === "session") {
    return (
      <CardSession
        queue={view.queue}
        onAnswer={(card, outcome, firstTry) => record(card.id, outcome, Date.now(), firstTry)}
        onExit={(results) => {
          refreshNow();
          setView(results.length ? { kind: "summary", results } : { kind: "home" });
        }}
      />
    );
  }

  const ratio = Math.min(today.answered / goal, 1);
  const days = streak(completed, now);

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-8">
      {view.kind === "summary" && (
        <section className="mb-6 rounded-card border border-line bg-surface p-5" aria-live="polite">
          <p className="text-sm text-muted">이번 학습</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {view.results.filter((r) => r.outcome !== "wrong").length}
            <span className="text-base text-muted"> / {view.results.length} 정답</span>
          </p>
          {view.results.some((r) => r.outcome === "wrong") && <p className="mt-1 text-[13px] text-warn">틀린 카드는 5분 뒤 복습 대기열로 돌아옵니다</p>}
        </section>
      )}

      <section className="rounded-card border border-line bg-surface p-5">
        <div className="flex items-center gap-5">
          <div className="relative h-20 w-20 shrink-0">
            <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90" aria-hidden="true">
              <circle cx="18" cy="18" r="15.5" fill="none" className="stroke-fg/10" strokeWidth="3.5" />
              <circle cx="18" cy="18" r="15.5" fill="none" className="stroke-accent transition-[stroke-dashoffset] duration-500" strokeWidth="3.5" strokeLinecap="round" strokeDasharray={97.4} strokeDashoffset={97.4 * (1 - ratio)} />
            </svg>
            <span className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-semibold tabular-nums">{Math.min(today.answered, goal)}</span>
              <span className="text-[10px] text-muted tabular-nums">/ {goal}</span>
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold tracking-tight">오늘의 카드</h1>
            <p className="mt-1 flex items-center gap-1 text-sm text-muted">
              <Flame size={14} className={days ? "text-warn" : ""} aria-hidden="true" />
              <span className="tabular-nums">{days}일 연속</span>
            </p>
          </div>
        </div>
        <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
          {[
            ["복습 대기", dueCount],
            ["새 카드", freshCount],
            ["익힌 카드", pool.filter((c) => (store.cards[c.id]?.box ?? 0) >= MASTERED_BOX).length],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-fg/5 py-2.5">
              <dt className="text-[11px] text-muted">{label}</dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        <button
          type="button"
          onClick={start}
          disabled={!dueCount && !freshCount}
          className="mt-5 h-12 w-full rounded-xl bg-accent text-[15px] font-semibold text-white hover:bg-accent/85 disabled:opacity-45"
        >
          {!dueCount && !freshCount ? "모든 카드를 익혔습니다" : remaining === 0 ? `${goal}장 더 풀기` : today.answered ? "이어서 풀기" : "시작하기"}
        </button>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-muted">덱</h2>
        <ul className="mt-3 divide-y divide-line rounded-card border border-line bg-surface">
          {decks.map((d) => {
            const deckCards = d.cards.filter((c) => matchesDialect(c, dialect));
            const mastered = deckCards.filter((c) => (store.cards[c.id]?.box ?? 0) >= MASTERED_BOX).length;
            const seen = deckCards.filter((c) => store.cards[c.id]).length;
            return (
              <li key={d.id} className="flex items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1 truncate text-[14px]">{d.title}</span>
                <span className="h-1.5 w-24 overflow-hidden rounded-full bg-fg/10" aria-hidden="true">
                  <span className="block h-full bg-fg/30" style={{ width: `${deckCards.length ? (seen / deckCards.length) * 100 : 0}%` }}>
                    <span className="block h-full bg-accent" style={{ width: `${seen ? (mastered / seen) * 100 : 0}%` }} />
                  </span>
                </span>
                <span className="w-12 text-right font-mono text-xs text-muted tabular-nums">
                  {mastered}/{deckCards.length}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-6 space-y-5 rounded-card border border-line bg-surface p-5">
        <div>
          <p className="mb-2 text-sm">하루 목표</p>
          <SegmentedControl label="하루 목표" size="sm" options={GOALS.map((g) => ({ value: String(g), label: `${g}장` }))} value={String(goal)} onChange={(v) => updateSettings({ goal: Number(v) })} />
        </div>
        <div>
          <p className="mb-2 text-sm">방언</p>
          <SegmentedControl label="방언" size="sm" options={DIALECT_OPTIONS} value={dialect} onChange={(v) => updateSettings({ dialect: v })} />
        </div>
        <PushToggle goal={goal} />
      </section>
    </div>
  );
}
