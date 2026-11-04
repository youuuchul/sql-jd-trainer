import { notFound } from "next/navigation";
import { LockGate } from "@/components/LockGate";
import { MockExam } from "@/components/workspace/MockExam";
import { getSchema, getSet, listSets, setProblems } from "@/lib/content/loader";

export const generateStaticParams = () => listSets().filter((s) => s.mode === "mock").map((s) => ({ set: s.id }));

export default async function MockPage({ params }: PageProps<"/mock/[set]">) {
  const { set: setId } = await params;
  const set = getSet(setId);
  if (!set) notFound();
  const schema = getSchema(set.schema);
  if (!schema) notFound();
  return <LockGate locked={schema.locked} title={set.title} render={() => <MockExam set={set} problems={setProblems(set)} schema={schema} />} />;
}
