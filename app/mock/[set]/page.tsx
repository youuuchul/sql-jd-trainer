import { notFound } from "next/navigation";
import { LockGate } from "@/components/LockGate";
import { MockExam } from "@/components/workspace/MockExam";
import { getSchema, getSet, listSets, setProblems } from "@/lib/content/loader";

export const generateStaticParams = async () => (await listSets()).filter((s) => s.mode === "mock").map((s) => ({ set: s.id }));

export default async function MockPage({ params }: PageProps<"/mock/[set]">) {
  const { set: setId } = await params;
  const set = await getSet(setId);
  if (!set) notFound();
  const schema = await getSchema(set.schema);
  if (!schema) notFound();
  const problems = await setProblems(set);
  return <LockGate locked={schema.locked} title={set.title} render={() => <MockExam set={set} problems={problems} schema={schema} />} />;
}
