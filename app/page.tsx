import { DailyApp } from "@/components/daily/DailyApp";
import { listDecks, listSyntax } from "@/lib/content/loader";
import { listPathSets } from "@/lib/content/path-sets";

export default async function TodayPage() {
  const [decks, syntax, pathSets] = await Promise.all([listDecks(), listSyntax(), listPathSets()]);
  return <DailyApp decks={decks} syntax={syntax} pathSets={pathSets} />;
}
