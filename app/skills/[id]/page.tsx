import { notFound } from "next/navigation";
import { SkillDetail } from "@/components/skills/SkillDetail";
import { listSkills, listSyntax } from "@/lib/content/loader";
import { listSkillViews } from "@/lib/content/skill-index";

export const generateStaticParams = async () => (await listSkills()).map((s) => ({ id: s.id }));

export default async function SkillPage({ params }: PageProps<"/skills/[id]">) {
  const { id } = await params;
  const [views, skills, syntax] = await Promise.all([listSkillViews(), listSkills(), listSyntax()]);
  const view = views.find((s) => s.id === id);
  const skill = skills.find((s) => s.id === id);
  if (!view || !skill) notFound();
  return <SkillDetail skill={view} syntax={syntax.filter((s) => skill.syntax.includes(s.id))} />;
}
