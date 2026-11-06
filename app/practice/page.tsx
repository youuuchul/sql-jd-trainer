import { PracticeView } from "@/components/practice/PracticeView";
import { listPathSets } from "@/lib/content/path-sets";

export default async function PracticePage() {
  return <PracticeView sets={await listPathSets()} />;
}
