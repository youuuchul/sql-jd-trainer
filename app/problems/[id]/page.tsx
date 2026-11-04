import { notFound } from "next/navigation";
import { LockGate } from "@/components/LockGate";
import { Workspace } from "@/components/workspace/Workspace";
import { getProblem, getSchema, listProblems } from "@/lib/content/loader";

export const generateStaticParams = () => listProblems().map((p) => ({ id: p.id }));

export default async function ProblemPage({ params }: PageProps<"/problems/[id]">) {
  const { id } = await params;
  const problem = getProblem(id);
  if (!problem) notFound();
  const schema = getSchema(problem.schema);
  if (!schema) notFound();
  return <LockGate locked={schema.locked} title={schema.domain} render={() => <Workspace problem={problem} schema={schema} />} />;
}
