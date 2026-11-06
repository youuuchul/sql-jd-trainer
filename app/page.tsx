import { DailyApp } from "@/components/daily/DailyApp";
import { listDecks, listSyntax } from "@/lib/content/loader";

export default async function TodayPage() {
  const [decks, syntax] = await Promise.all([listDecks(), listSyntax()]);
  return <DailyApp decks={decks} syntax={syntax} />;
}
