import { notFound } from "next/navigation";
import { LOCKED_TITLE, LockGate } from "@/components/LockGate";
import { Workspace } from "@/components/workspace/Workspace";
import { getProblem, getSchema, listProblems } from "@/lib/content/loader";

export const generateStaticParams = async () => (await listProblems()).map((p) => ({ id: p.id }));

export default async function ProblemPage({ params }: PageProps<"/problems/[id]">) {
  const { id } = await params;
  const problem = await getProblem(id);
  if (!problem) notFound();
  const schema = await getSchema(problem.schema);
  if (!schema) notFound();
  return <LockGate locked={schema.locked} title={LOCKED_TITLE} render={() => <Workspace problem={problem} schema={schema} />} />;
}
