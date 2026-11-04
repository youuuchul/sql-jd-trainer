import type { Metadata } from "next";
import { DailyApp } from "@/components/daily/DailyApp";
import { listDecks, listSyntax } from "@/lib/content/loader";

export const metadata: Metadata = { title: "오늘의 카드 · SQL JD Trainer" };

export default async function DailyPage() {
  const [decks, syntax] = await Promise.all([listDecks(), listSyntax()]);
  return <DailyApp decks={decks} syntax={syntax} />;
}
