import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SkillCards } from "@/components/skills/SkillCards";
import { listDecks, listSkills, listSyntax } from "@/lib/content/loader";
import { isShown } from "@/lib/daily/srs";

export const metadata: Metadata = { title: "유형 카드 · 하루쿼리" };

export const generateStaticParams = async () => (await listSkills()).map((s) => ({ id: s.id }));

export default async function SkillCardsPage({ params }: PageProps<"/skills/[id]/cards">) {
  const { id } = await params;
  const [skills, decks, syntax] = await Promise.all([listSkills(), listDecks(), listSyntax()]);
  const skill = skills.find((s) => s.id === id);
  if (!skill) notFound();
  const cards = decks.flatMap((d) => d.cards.filter((c) => isShown(c) && c.syntax.some((ref) => skill.syntax.includes(ref))).map((c) => ({ ...c, deckTitle: d.title })));
  if (!cards.length) notFound();
  return <SkillCards skillId={skill.id} cards={cards} syntax={Object.fromEntries(syntax.map((s) => [s.id, s]))} />;
}
