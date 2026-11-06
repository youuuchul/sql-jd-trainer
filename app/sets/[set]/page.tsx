import Link from "next/link";
import { notFound } from "next/navigation";
import { LockGate } from "@/components/LockGate";
import { ProblemList } from "@/components/ProblemList";
import { Badge } from "@/components/ui-lab/components/badge/Badge";
import { getSchema, getSet, listSets, setProblems } from "@/lib/content/loader";
import type { Problem, ProblemSet, SchemaDef } from "@/lib/content/types";

export const generateStaticParams = async () => (await listSets()).map((s) => ({ set: s.id }));

export default async function SetPage({ params }: PageProps<"/sets/[set]">) {
  const { set: setId } = await params;
  const set = await getSet(setId);
  if (!set) notFound();
  const schema = await getSchema(set.schema);
  const problems = await setProblems(set);
  return <LockGate locked={schema?.locked ?? false} title={set.title} render={() => <SetView set={set} schema={schema} problems={problems} />} />;
}

function SetView({ set, schema, problems }: { set: ProblemSet; schema: SchemaDef | undefined; problems: Problem[] }) {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-10">
      <Link href="/practice" className="text-xs text-muted hover:text-fg">
        ← 문제 세트
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{set.title}</h1>
        {schema && <Badge size="sm">{schema.domain}</Badge>}
      </div>
      <p className="mt-2 text-[14.5px] leading-relaxed text-fg/80">{set.description}</p>
      {set.mode === "mock" && (
        <Link href={`/mock/${set.id}`} className="mt-4 inline-flex h-9 items-center rounded-lg bg-accent px-3 text-sm font-semibold text-white hover:bg-accent/85">
          타이머 모드로 시작
        </Link>
      )}
      <div className="mt-6">
        <ProblemList problems={problems} />
      </div>
    </div>
  );
}
