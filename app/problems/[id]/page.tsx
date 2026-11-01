import { notFound } from "next/navigation";
import { Workspace } from "@/components/workspace/Workspace";
import { getProblem, getSchema, listProblems } from "@/lib/content/loader";

export const generateStaticParams = () => listProblems().map((p) => ({ id: p.id }));

export default async function ProblemPage({ params }: PageProps<"/problems/[id]">) {
  const { id } = await params;
  const problem = getProblem(id);
  if (!problem) notFound();
  const schema = getSchema(problem.schema);
  if (!schema) notFound();
  return <Workspace problem={problem} schema={schema} />;
}
