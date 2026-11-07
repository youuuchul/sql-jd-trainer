import { notFound } from "next/navigation";
import { LockGate } from "@/components/LockGate";
import { ProblemList } from "@/components/ProblemList";
import { BackButton } from "@/components/practice/SolveHeader";
import { splitSetTitle } from "@/components/practice/setTitle";
import { Button } from "@/components/ui/Button";
import { CAT_CLASS } from "@/components/ui/category";
import { Icon } from "@/components/ui/icons";
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
  const { kicker, name } = splitSetTitle(set.title, set.category);
  const minutes = problems.reduce((a, p) => a + (p.timeLimitMin ?? 0), 0);
  return (
    <div className="mx-auto w-full max-w-3xl px-5 pt-3 pb-8 lg:px-10 lg:py-8">
      <div className="flex items-center gap-3">
        <BackButton href="/practice" />
        <span className={`${CAT_CLASS[set.category]} hq-catink text-sm font-bold`}>{kicker}</span>
      </div>
      <div className={`${CAT_CLASS[set.category]} hq-catfill mt-4 rounded-[20px] px-[18px] pt-4 pb-[18px]`}>
        <div className="flex flex-wrap items-center gap-1.5">
          {schema && <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-bold">{schema.domain}</span>}
          <span className="font-mono text-xs font-bold opacity-85">
            {problems.length}문제{minutes > 0 ? ` · 권장 ${minutes}분` : ""}
          </span>
        </div>
        <h1 className="mt-2 text-2xl leading-tight font-extrabold tracking-[-0.03em]">{name}</h1>
        <p className="mt-1.5 text-[14px] leading-[1.55] font-medium opacity-85">{set.description}</p>
        {set.mode === "mock" && (
          <Button href={`/mock/${set.id}`} tone="inverse" size="sm" className="mt-4">
            <Icon name="timer" size={17} />
            타이머 모드로 시작
          </Button>
        )}
      </div>
      <div className="mt-5">
        <ProblemList problems={problems} />
      </div>
    </div>
  );
}
