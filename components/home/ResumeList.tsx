import Link from "next/link";
import { Chip } from "@/components/ui/Chip";
import { CAT_CLASS, CAT_SHORT } from "@/components/ui/category";
import { FORMAT_ICON, Icon } from "@/components/ui/icons";
import { DIALECT_LABEL, DIFFICULTY_LABEL, FORMAT_LABEL, UI_DIALECTS } from "@/lib/content/types";
import type { PathNode } from "@/lib/path";

const kicker = (n: PathNode) => (n.set.category === "basics" || !n.set.domain ? `${n.set.title} · ${n.index + 1} / ${n.set.problems.length}` : `${CAT_SHORT[n.set.category]} · ${n.set.domain}`);

const meta = (n: PathNode) => {
  const dialect = UI_DIALECTS.find((d) => n.progress?.sql[d] !== undefined);
  return [dialect ? DIALECT_LABEL[dialect] : "", FORMAT_LABEL[n.problem.format], DIFFICULTY_LABEL[n.problem.difficulty], n.problem.timeLimitMin ? `${n.problem.timeLimitMin}분` : ""].filter(Boolean).join(" · ");
};

/** 풀던 문제 한 줄. 문제 풀이로 이동한다 */
export function ResumeRow({ node, chip }: { node: PathNode; chip: "미통과" | "다음" }) {
  return (
    <Link
      href={`/problems/${node.problem.id}`}
      className={`${CAT_CLASS[node.set.category]} flex items-center gap-3.5 rounded-[18px] bg-surface px-3.5 py-[13px] shadow-[inset_0_0_0_1.5px_var(--color-line),0_3px_0_var(--color-line)] dark:shadow-[inset_0_0_0_1px_var(--color-line)]`}
    >
      <span className="hq-catfill grid size-[46px] shrink-0 place-items-center rounded-[14px]">
        <Icon name={FORMAT_ICON[node.problem.format]} size={22} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="hq-catink block truncate text-xs font-bold">{kicker(node)}</span>
        <span className="block truncate text-[15.5px] leading-[1.35] font-bold tracking-[-0.02em]">{node.problem.title}</span>
        <span className="mt-px block truncate text-[12.5px] font-medium text-muted">{meta(node)}</span>
      </span>
      <Chip tone={chip === "미통과" ? "fail" : "accent"} size="sm">
        {chip}
      </Chip>
    </Link>
  );
}
