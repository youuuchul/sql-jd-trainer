import { notFound } from "next/navigation";
import { LOCKED_TITLE, LockGate } from "@/components/LockGate";
import type { SetNav } from "@/components/practice/SolveHeader";
import { Workspace } from "@/components/workspace/Workspace";
import { getProblem, getSchema, listProblems, listSets } from "@/lib/content/loader";
import { SetCategorySchema, type ProblemSet } from "@/lib/content/types";

export const generateStaticParams = async () => (await listProblems()).map((p) => ({ id: p.id }));

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
  const [sets, all] = await Promise.all([listSets(), listProblems()]);
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
  return <LockGate locked={schema.locked} title={LOCKED_TITLE} render={() => <Workspace problem={problem} schema={schema} nav={nav} />} />;
}
