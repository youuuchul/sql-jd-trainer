import type { Metadata } from "next";
import { DailyApp } from "@/components/daily/DailyApp";
import { listDecks, listSyntax } from "@/lib/content/loader";
import { listPathSets } from "@/lib/content/path-sets";
import { listSkillViews } from "@/lib/content/skill-index";

export const metadata: Metadata = { title: "오늘의 카드 · 하루쿼리" };

export default async function DailyPage() {
  const [decks, syntax, pathSets, skills] = await Promise.all([listDecks(), listSyntax(), listPathSets(), listSkillViews()]);
  return <DailyApp decks={decks} syntax={syntax} pathSets={pathSets} skills={skills} />;
}
