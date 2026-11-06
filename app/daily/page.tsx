import type { Metadata } from "next";
import { DailyApp } from "@/components/daily/DailyApp";
import { listDecks, listSyntax } from "@/lib/content/loader";
import { listPathSets } from "@/lib/content/path-sets";

export const metadata: Metadata = { title: "오늘의 카드 · 하루쿼리" };

export default async function DailyPage() {
  const [decks, syntax, pathSets] = await Promise.all([listDecks(), listSyntax(), listPathSets()]);
  return <DailyApp decks={decks} syntax={syntax} pathSets={pathSets} />;
}
