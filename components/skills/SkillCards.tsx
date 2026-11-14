"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CardSession, type SessionCard } from "@/components/daily/CardSession";
import type { Card, SyntaxRef } from "@/lib/content/types";
import { buildQueue, matchesDialect, type DialectFilter } from "@/lib/daily/srs";
import { useDailyStore, useNow } from "@/lib/daily/store";

type DeckCard = Card & { deckTitle: string };

interface Props {
  skillId: string;
  cards: DeckCard[];
  syntax: Record<string, SyntaxRef>;
}

/** 한 유형의 카드만 푸는 세션. 복습할 카드, 처음 보는 카드, 나머지(복습이 가까운 순) 순서로 모두 낸다 */
export function SkillCards(props: Props) {
  const [now] = useNow();
  // 저장된 카드 기록은 하이드레이션 뒤에 읽힌다
  if (now === 0) return null;
  return <Session {...props} now={now} />;
}

function Session({ skillId, cards, syntax, now }: Props & { now: number }) {
  const router = useRouter();
  const { store, record } = useDailyStore();
  const dialect: DialectFilter = cards.some((c) => matchesDialect(c, store.settings.dialect)) ? store.settings.dialect : "all";
  const [queue] = useState<SessionCard[]>(() => {
    const first = buildQueue(cards, store.cards, { now, size: cards.length, filter: dialect, seedText: skillId });
    const picked = new Set(first.map((c) => c.id));
    const rest = cards.filter((c) => matchesDialect(c, dialect) && !picked.has(c.id)).sort((a, b) => store.cards[a.id].due - store.cards[b.id].due);
    return [...first, ...rest].map((c) => ({ ...c, fresh: !store.cards[c.id], prev: store.cards[c.id] }));
  });
  return (
    <CardSession
      queue={queue}
      syntax={syntax}
      dialectFilter={dialect}
      onAnswer={(card, outcome, firstTry) => record(card.id, outcome, Date.now(), firstTry)}
      onExit={() => router.push(`/skills/${skillId}`)}
    />
  );
}
