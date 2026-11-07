import Link from "next/link";
import { CAT_CLASS, CAT_SHORT } from "@/components/ui/category";
import { FORMAT_ICON, Icon } from "@/components/ui/icons";
import { PathNode } from "@/components/ui/PathNode";
import { DIFFICULTY_LABEL, FORMAT_LABEL, SET_CATEGORY_LABEL, type SetCategory } from "@/lib/content/types";
import type { CategoryPath, PathNode as PathNodeData, SetPath } from "@/lib/path";

const WINDOW = 6;

/** 노드가 많은 세트는 지금 문제를 포함한 6개만 보인다 */
const windowOf = (nodes: PathNodeData[]) => {
  const cur = Math.max(
    nodes.findIndex((n) => n.state === "cur"),
    0,
  );
  const start = Math.min(Math.max(cur - 2, 0), Math.max(nodes.length - WINDOW, 0));
  return { start, items: nodes.slice(start, start + WINDOW) };
};

const problemMeta = (n: PathNodeData) => [FORMAT_LABEL[n.problem.format], DIFFICULTY_LABEL[n.problem.difficulty], n.problem.timeLimitMin ? `${n.problem.timeLimitMin}분` : ""].filter(Boolean).join(" · ");

/** 분류에서 지금 보여 줄 세트: 지금 문제가 있는 세트, 다 풀었으면 마지막 세트 */
export const focusSet = (c: CategoryPath): SetPath | undefined => c.sets.find((s) => s.nodes.some((n) => n.state === "cur")) ?? c.sets[c.sets.length - 1];

/** 모바일 진행 경로: 세트 이름과 통과 수, 노드 줄, 지금 문제 말풍선 */
export function MobilePath({ set }: { set: SetPath }) {
  const { items } = windowOf(set.nodes);
  const n = items.length;
  const curIdx = items.findIndex((x) => x.state === "cur");
  const fill = n > 1 ? (curIdx < 0 ? 1 : curIdx / (n - 1)) : 0;
  const span = Math.min(n >= 6 ? 4 : 3, n);
  const bStart = curIdx < 0 ? 0 : Math.min(Math.max(curIdx - 1, 0), n - span);
  const arrow = curIdx < 0 ? 50 : ((curIdx - bStart + 0.5) / span) * 100;
  const cur = curIdx < 0 ? null : items[curIdx];
  return (
    <section aria-label="진행 경로" className={`${CAT_CLASS[set.set.category]} mt-6`}>
      <div className="mx-0.5 mb-2.5 flex items-baseline justify-between">
        <h3 className="text-[17px] font-extrabold tracking-[-0.02em]">{set.set.title}</h3>
        <span className="font-mono text-[13px] font-semibold text-muted tabular-nums">
          {set.passed} / {set.total}
        </span>
      </div>
      <div className="relative">
        <div className="absolute top-[27px] h-1 rounded-sm bg-line-2" style={{ left: `${50 / n}%`, right: `${50 / n}%` }} aria-hidden="true">
          <i className="absolute inset-y-0 left-0 rounded-sm bg-[var(--cat)]" style={{ width: `${fill * 100}%` }} />
        </div>
        <div className="relative grid h-[58px] items-center justify-items-center" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}>
          {items.map((x) => (
            <PathNode key={x.problem.id} state={x.state} category={x.set.category} icon={FORMAT_ICON[x.problem.format]} size={x.state === "cur" ? 46 : 38} href={`/problems/${x.problem.id}`} label={x.problem.title} />
          ))}
        </div>
        {cur && (
          <div className="relative mt-4 grid" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}>
            <Link
              href={`/problems/${cur.problem.id}`}
              className="relative rounded-[14px] bg-surface px-3 pt-2.5 pb-[11px] shadow-[inset_0_0_0_1.5px_var(--color-line-2),0_3px_0_var(--color-line-2)] dark:shadow-[inset_0_0_0_1px_var(--color-line-2),0_8px_24px_-8px_#000]"
              style={{ gridColumn: `${bStart + 1} / span ${span}` }}
            >
              <span aria-hidden="true" className="absolute -top-[7px] size-3 -translate-x-1/2 rotate-45 rounded-tl-sm bg-surface shadow-[-1.5px_-1.5px_0_var(--color-line-2)] dark:shadow-[-1px_-1px_0_var(--color-line-2)]" style={{ left: `${arrow}%` }} />
              <b className="block text-sm leading-[1.35] font-bold">{cur.problem.title}</b>
              <span className="mt-[3px] block text-xs font-semibold text-muted">{problemMeta(cur)}</span>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

const SET_NAME = /^(\S+\s+\d+)\.\s*(.+)$/;
const setName = (s: SetPath, index: number) => {
  const m = SET_NAME.exec(s.set.title);
  return m ? { no: m[1].split(/\s+/)[1], head: m[1], tail: m[2] } : { no: String(index + 1), head: s.set.title, tail: "" };
};

const OFFSETS = [22, 8, 34, 6, 30, 8, 32, 14];

/** 데스크톱 진행 경로: 앞뒤 세트 메달과 문제 노드를 물결선으로 잇는다 */
export function DesktopPath({ categories, category, onCategory }: { categories: CategoryPath[]; category: SetCategory; onCategory: (c: SetCategory) => void }) {
  const cat = categories.find((c) => c.category === category) ?? categories[0];
  const set = focusSet(cat);
  const setIdx = set ? cat.sets.indexOf(set) : -1;
  const prev = setIdx > 0 ? cat.sets[setIdx - 1] : undefined;
  const nextSet = setIdx >= 0 ? cat.sets[setIdx + 1] : undefined;
  const { items } = set ? windowOf(set.nodes) : { items: [] as PathNodeData[] };
  type Cell = { kind: "medal"; set: SetPath; index: number } | { kind: "node"; node: PathNodeData };
  const cells: Cell[] = [...(prev ? [{ kind: "medal" as const, set: prev, index: setIdx - 1 }] : []), ...items.map((node) => ({ kind: "node" as const, node })), ...(nextSet ? [{ kind: "medal" as const, set: nextSet, index: setIdx + 1 }] : [])];
  const n = cells.length;
  const sizeOf = (c: Cell) => (c.kind === "medal" ? 60 : c.node.state === "cur" ? 72 : 64);
  const pts = cells.map((c, i) => ({ x: (i + 0.5) * 100, y: OFFSETS[i % OFFSETS.length] + sizeOf(c) / 2 }));
  const segments = pts.slice(1).map((p, i) => {
    const a = pts[i];
    const mid = (a.x + p.x) / 2;
    const c = cells[i];
    const done = c.kind === "medal" ? c.set.state === "done" : c.node.state === "done";
    return { d: `M${a.x} ${a.y} C${mid} ${a.y} ${mid} ${p.y} ${p.x} ${p.y}`, done };
  });
  return (
    <section aria-label="진행 경로" className={`${CAT_CLASS[category]} mt-5 rounded-[18px] bg-surface px-6 pt-5 pb-[22px] shadow-[inset_0_0_0_1.5px_var(--color-line),0_3px_0_var(--color-line)] dark:shadow-[inset_0_0_0_1px_var(--color-line)]`}>
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="mr-2 text-[17px] font-extrabold tracking-[-0.02em]">진행 경로</h3>
        {categories.map((c) =>
          c.locked ? (
            <span key={c.category} className="inline-flex h-[30px] items-center gap-1.5 rounded-full bg-surface-2 px-3 text-[13px] font-bold text-muted">
              <Icon name="lock" size={14} />
              {SET_CATEGORY_LABEL[c.category].replace("비공개 ", "")}
            </span>
          ) : (
            <button
              key={c.category}
              type="button"
              aria-pressed={c.category === category}
              onClick={() => onCategory(c.category)}
              className={`${CAT_CLASS[c.category]} inline-flex h-[30px] items-center gap-1.5 rounded-full px-3 text-[13px] font-bold ${c.category === category ? "hq-catfill" : "bg-surface-2 text-fg-2"}`}
            >
              {c.category !== category && <i aria-hidden="true" className="size-2 rounded-full bg-[var(--cat)]" />}
              {SET_CATEGORY_LABEL[c.category]}
            </button>
          ),
        )}
      </div>
      {n > 0 && (
        <div className="relative mt-5 grid h-[170px]" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}>
          <svg aria-hidden="true" viewBox={`0 0 ${n * 100} 170`} preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
            {segments.map((s, i) => (
              <path key={i} d={s.d} fill="none" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeWidth={4} stroke={s.done ? "color-mix(in srgb, var(--cat) 45%, transparent)" : "var(--color-line-2)"} strokeDasharray={s.done ? undefined : "0.1 9"} />
            ))}
          </svg>
          {cells.map((c, i) => {
            const y = OFFSETS[i % OFFSETS.length];
            if (c.kind === "medal") {
              const nm = setName(c.set, c.index);
              const done = c.set.state === "done";
              return (
                <div key={c.set.set.id} className="relative flex flex-col items-center text-center">
                  <span style={{ marginTop: y }} className={`relative grid size-[60px] place-items-center rounded-[20px] font-mono text-xl font-extrabold ${done ? "hq-catfill" : "bg-surface-2 text-muted shadow-[inset_0_0_0_2px_var(--color-line-2)]"}`}>
                    {nm.no}
                    {done && (
                      <span className="absolute -top-1.5 -right-1.5 grid size-[22px] place-items-center rounded-full bg-pass text-white shadow-[0_0_0_3px_var(--color-surface)]">
                        <Icon name="check" size={13} strokeWidth={2.8} />
                      </span>
                    )}
                  </span>
                  <p className="mt-3.5 max-w-[124px] text-[12.5px] leading-[1.4] font-semibold text-fg-2">
                    <b className="block font-extrabold text-fg">{nm.head}</b>
                    {nm.tail}
                  </p>
                </div>
              );
            }
            const x = c.node;
            const cur = x.state === "cur";
            return (
              <div key={x.problem.id} className="relative flex flex-col items-center text-center">
                <span style={{ marginTop: y }}>
                  <PathNode state={x.state} category={x.set.category} icon={FORMAT_ICON[x.problem.format]} size={cur ? 72 : 64} href={`/problems/${x.problem.id}`} label={x.problem.title} />
                </span>
                <p className={`${cur ? "mt-[30px]" : "mt-[22px]"} max-w-[124px] text-[12.5px] leading-[1.4] font-semibold text-fg-2`}>
                  {cur ? (
                    <>
                      <b className="block font-extrabold text-[color-mix(in_srgb,var(--cat)_84%,var(--color-fg))]">{x.problem.title}</b>
                      {problemMeta(x)}
                    </>
                  ) : (
                    x.problem.title
                  )}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/** 데스크톱 분류 타일 줄: 분류별 세트 수·문제 수·통과 수 */
export function CategoryTiles({ categories }: { categories: CategoryPath[] }) {
  return (
    <ul className="m-0 mt-5 grid list-none grid-cols-5 gap-3.5 p-0">
      {categories.map((c) => {
        const problems = c.total;
        if (c.locked)
          return (
            <li key={c.category} className="flex h-[104px] flex-col rounded-[20px] bg-surface-2 p-[13px] text-muted shadow-[inset_0_0_0_1.5px_var(--color-line-2)]">
              <Icon name="lock" size={20} className="mb-2" />
              <b className="text-[15px] leading-tight font-extrabold tracking-[-0.03em]">{CAT_SHORT[c.category]}</b>
              <span className="mt-0.5 text-[11.5px] font-semibold opacity-80">{c.sets.length}세트</span>
            </li>
          );
        return (
          <li key={c.category} className={`${CAT_CLASS[c.category]} hq-catfill flex h-[104px] flex-col rounded-[20px] p-[13px]`}>
            <Link href="/practice" className="flex h-full flex-col">
              <b className="text-[15px] leading-tight font-extrabold tracking-[-0.03em]">{SET_CATEGORY_LABEL[c.category]}</b>
              <span className="mt-0.5 text-[11.5px] font-semibold opacity-85">
                {c.sets.length}세트 · {problems}문제
              </span>
              <span className="mt-auto h-1.5 overflow-hidden rounded-[3px] bg-white/30" aria-hidden="true">
                <i className="block h-full rounded-[3px] bg-white" style={{ width: `${problems ? (c.passed / problems) * 100 : 0}%` }} />
              </span>
              <em className="mt-1.5 font-mono text-[11.5px] leading-none font-bold not-italic opacity-90">
                {c.passed} / {problems}
              </em>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}


