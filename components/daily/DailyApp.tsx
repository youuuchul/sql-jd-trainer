"use client";
import { useMemo, useRef, useState } from "react";
import { Home } from "@/components/home/Home";
import type { SkillView } from "@/lib/skills";
import { SettingsSheet } from "@/components/home/SettingsSheet";
import type { PathSet } from "@/lib/path";
import type { CardDeck, SyntaxRef } from "@/lib/content/types";
import { buildQueue, dayKey, isShown, MASTERED_BOX, matchesDialect, streak, weekOf, type DialectFilter } from "@/lib/daily/srs";
import { useDailyStore, useNow } from "@/lib/daily/store";
import { CardSession, type SessionCard, type SessionResult } from "./CardSession";
import { StreakScreen } from "./StreakScreen";

type View = { kind: "home" } | { kind: "session"; queue: SessionCard[] } | { kind: "streak"; results: SessionResult[] };

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export function DailyApp({ decks, syntax, pathSets, skills }: { decks: CardDeck[]; syntax: SyntaxRef[]; pathSets: PathSet[]; skills: SkillView[] }) {
  const { store, record, updateSettings } = useDailyStore();
  const [view, setView] = useState<View>({ kind: "home" });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const gearRef = useRef<HTMLButtonElement>(null);
  const [now, refreshNow] = useNow();
  const { goal } = store.settings;
  const dialect: DialectFilter = store.settings.dialect === "mysql" ? "all" : store.settings.dialect;

  const cards = useMemo(() => decks.flatMap((d) => d.cards.filter(isShown).map((c) => ({ ...c, deckTitle: d.title }))), [decks]);
  const syntaxById = useMemo(() => Object.fromEntries(syntax.map((s) => [s.id, s])), [syntax]);
  const today = store.days[dayKey(now)] ?? { answered: 0, correct: 0 };
  const completed = useMemo(() => new Set(Object.entries(store.days).filter(([, d]) => d.answered >= goal).map(([k]) => k)), [store.days, goal]);
  const pool = cards.filter((c) => matchesDialect(c, dialect));
  const dueCount = pool.filter((c) => store.cards[c.id] && store.cards[c.id].due <= now).length;
  const freshCount = pool.filter((c) => !store.cards[c.id]).length;
  const masteredCount = pool.filter((c) => (store.cards[c.id]?.box ?? 0) >= MASTERED_BOX).length;
  const remaining = Math.max(goal - today.answered, 0);

  const start = () => {
    const t = Date.now();
    const size = remaining || goal;
    const queue = buildQueue(cards, store.cards, { now: t, size, filter: dialect, seedText: `${dayKey(t)}:${today.answered}` }).map((c) => ({ ...c, fresh: !store.cards[c.id], prev: store.cards[c.id] }));
    if (queue.length) setView({ kind: "session", queue });
  };

  const week = useMemo(() => weekOf(now).map((d) => ({ label: d.label, today: d.today, on: completed.has(d.key) })), [now, completed]);
  const days = streak(completed, now);

  if (view.kind === "session") {
    return (
      <CardSession
        queue={view.queue}
        syntax={syntaxById}
        dialectFilter={dialect}
        onAnswer={(card, outcome, firstTry) => record(card.id, outcome, Date.now(), firstTry)}
        onExit={(results) => {
          refreshNow();
          const answered = store.days[dayKey(Date.now())]?.answered ?? 0;
          setView(results.length && answered >= goal ? { kind: "streak", results } : { kind: "home" });
        }}
      />
    );
  }

  if (view.kind === "streak") {
    const count = (o: SessionResult["outcome"]) => view.results.filter((r) => r.outcome === o).length;
    return (
      <StreakScreen
        days={days}
        week={week}
        summary={{ solved: view.results.length, correct: count("correct"), hinted: count("hinted"), wrong: count("wrong") }}
        goal={goal}
        canMore={dueCount + freshCount > 0}
        onContinue={() => setView({ kind: "home" })}
        onMore={start}
      />
    );
  }

  const date = new Date(now);
  return (
    <>
      <Home
        ready={now > 0}
        dateLabel={`${date.getMonth() + 1}월 ${date.getDate()}일 ${WEEKDAYS[date.getDay()]}요일`}
        goal={goal}
        answered={today.answered}
        streak={days}
        dueCount={dueCount}
        freshCount={freshCount}
        masteredCount={masteredCount}
        week={week}
        pathSets={pathSets}
        skills={skills}
        now={now}
        onStart={start}
        onOpenSettings={() => setSettingsOpen(true)}
        gearRef={gearRef}
      />
      {settingsOpen && <SettingsSheet goal={goal} dialect={dialect} onChange={updateSettings} onClose={() => {
            setSettingsOpen(false);
            gearRef.current?.focus();
          }}
        />}
    </>
  );
}
