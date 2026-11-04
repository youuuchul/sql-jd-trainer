import type { Metadata } from "next";
import { DailyApp } from "@/components/daily/DailyApp";
import { listDecks } from "@/lib/content/loader";

export const metadata: Metadata = { title: "오늘의 카드 · SQL JD Trainer" };

export default async function DailyPage() {
  return <DailyApp decks={await listDecks()} />;
}
