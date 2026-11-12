import { SkillsView } from "@/components/skills/SkillsView";
import { listSkillViews } from "@/lib/content/skill-index";

export default async function SkillsPage() {
  return <SkillsView skills={await listSkillViews()} />;
}
