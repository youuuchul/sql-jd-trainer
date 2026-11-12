import { DailyApp } from "@/components/daily/DailyApp";
import { listDecks, listSyntax } from "@/lib/content/loader";
import { listPathSets } from "@/lib/content/path-sets";
import { listSkillViews } from "@/lib/content/skill-index";

export default async function TodayPage() {
  const [decks, syntax, pathSets, skills] = await Promise.all([listDecks(), listSyntax(), listPathSets(), listSkillViews()]);
  return <DailyApp decks={decks} syntax={syntax} pathSets={pathSets} skills={skills} />;
}
