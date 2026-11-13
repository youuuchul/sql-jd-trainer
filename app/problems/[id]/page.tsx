import { notFound } from "next/navigation";
import { LOCKED_TITLE, LockGate } from "@/components/LockGate";
import type { SetNav } from "@/components/practice/SolveHeader";
import { Workspace } from "@/components/workspace/Workspace";
import { SHELF_CATEGORY } from "@/components/skills/shelf";
import { getProblem, getSchema, listProblemMeta, listSets } from "@/lib/content/loader";
import { listSkillViews } from "@/lib/content/skill-index";
import { SetCategorySchema, type ProblemSet } from "@/lib/content/types";

export const generateStaticParams = async () => (await listProblemMeta()).map((p) => ({ id: p.id }));

/** 문제가 들어 있는 세트 중 연습 세트(분류 순서 → order)를 먼저 고른다 */
const pickSet = (sets: ProblemSet[], problemId: string): ProblemSet | undefined => {
  const rank = (s: ProblemSet) => (s.mode === "practice" ? 0 : 100) + SetCategorySchema.options.indexOf(s.category);
  return sets.filter((s) => s.problems.includes(problemId)).sort((a, b) => rank(a) - rank(b) || a.order - b.order)[0];
};

export default async function ProblemPage({ params }: PageProps<"/problems/[id]">) {
  const { id } = await params;
  const problem = await getProblem(id);
  if (!problem) notFound();
  const schema = await getSchema(problem.schema);
  if (!schema) notFound();
  const [sets, all, skillViews] = await Promise.all([listSets(), listProblemMeta(), listSkillViews()]);
  const set = pickSet(sets, id);
  const titles = new Map(all.map((p) => [p.id, p.title]));
  const nav: SetNav | undefined = set && {
    setId: set.id,
    setTitle: set.title,
    category: set.category,
    domain: schema.domain,
    items: set.problems.flatMap((pid) => (titles.has(pid) ? [{ id: pid, title: titles.get(pid)! }] : [])),
    index: Math.max(0, set.problems.filter((pid) => titles.has(pid)).indexOf(id)),
  };
  const skillNavs: Record<string, SetNav> = Object.fromEntries(
    skillViews
      .filter((s) => problem.skills.includes(s.id) && s.problems.some((p) => p.id === id))
      .map((s) => [
        s.id,
        {
          setId: s.id,
          setTitle: s.title,
          category: SHELF_CATEGORY[s.shelf],
          domain: schema.domain,
          items: s.problems.map((p) => ({ id: p.id, title: p.title })),
          index: s.problems.findIndex((p) => p.id === id),
          back: `/skills/${s.id}`,
          label: s.title,
          query: `?skill=${s.id}`,
        },
      ]),
  );
  return <LockGate locked={schema.locked} title={LOCKED_TITLE} render={() => <Workspace problem={problem} schema={schema} nav={nav} skillNavs={skillNavs} />} />;
}
