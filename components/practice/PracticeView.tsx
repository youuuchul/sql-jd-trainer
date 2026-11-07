"use client";
import Link from "next/link";
import { useLayoutEffect, useMemo, useSyncExternalStore, type CSSProperties } from "react";
import { PathScene } from "@/components/path/PathScene";
import { sceneFor } from "@/components/path/scenes";
import { CAT_CLASS, CAT_SHORT } from "@/components/ui/category";
import { FORMAT_ICON, Icon } from "@/components/ui/icons";
import { PathNode } from "@/components/ui/PathNode";
import { splitSetTitle } from "./setTitle";
import { dayKey, streak } from "@/lib/daily/srs";
import { useDailyStore, useNow } from "@/lib/daily/store";
import { DIFFICULTY_LABEL, FORMAT_LABEL, SET_CATEGORY_LABEL, type SetCategory } from "@/lib/content/types";
import { usePath, type CategoryPath, type PathNode as PathNodeData, type PathSet, type SetPath } from "@/lib/path";

/** 사인파 경로의 노드별 좌우 비율. 진폭은 --amp(모바일 72px, 넓은 화면 96px) */
const WAVE = [0, 0.5, 0.86, 0.5, 0, -0.5, -0.86, -0.5];
/** 장면을 붙이는 기준 노드(세트의 3번째, 짧으면 마지막) */
const sceneIndex = (n: number) => Math.min(2, n - 1);

const nodeMeta = (n: PathNodeData) => `${FORMAT_LABEL[n.problem.format]} · ${DIFFICULTY_LABEL[n.problem.difficulty]}${n.problem.timeLimitMin ? ` · ${n.problem.timeLimitMin}분` : ""}`;

/** 연속 일수와 오늘 카드 수. 하루 카드 저장값을 읽기만 한다 */
function StatusLine() {
  const { store } = useDailyStore();
  const [now] = useNow();
  const { goal } = store.settings;
  const days = useMemo(() => streak(new Set(Object.entries(store.days).filter(([, d]) => d.answered >= goal).map(([k]) => k)), now), [store.days, goal, now]);
  const answered = now ? (store.days[dayKey(now)]?.answered ?? 0) : 0;
  return (
    <header className="flex h-12 items-center gap-2">
      <h1 className="mr-auto text-[19px] font-extrabold tracking-[-0.03em]">연습</h1>
      {now > 0 && (
        <>
          <span className={`inline-flex h-8 items-center gap-1 rounded-full pr-2.5 pl-2 text-[14px] font-extrabold tabular-nums ${days ? "bg-flame-soft text-flame-deep dark:text-flame" : "bg-surface-2 text-muted"}`} aria-label={`${days}일 연속`}>
            <Icon name="flame" size={17} filled className={days ? "text-flame" : "text-faint"} />
            {days}
          </span>
          <Link href="/" className="inline-flex h-8 items-center gap-1 rounded-full bg-surface-2 pr-2.5 pl-2 text-[14px] font-extrabold text-fg-2 tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" aria-label={`오늘 카드 ${answered} / ${goal}`}>
            <Icon name="today" size={16} strokeWidth={2.2} className="text-accent" />
            <span>
              {Math.min(answered, goal)}
              <span className="font-semibold text-muted">/{goal}</span>
            </span>
          </Link>
        </>
      )}
    </header>
  );
}

function CategoryChip({ cat, on, onSelect }: { cat: CategoryPath; on: boolean; onSelect: () => void }) {
  const base = "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[14px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
  if (cat.locked)
    return (
      <button type="button" onClick={onSelect} aria-pressed={on} className={`${base} ${CAT_CLASS.archive} ${on ? "bg-fg-2 text-bg" : "bg-surface-2 text-muted"}`}>
        <Icon name="lock" size={15} strokeWidth={2.2} />
        <b className="font-extrabold">{CAT_SHORT.archive}</b>
      </button>
    );
  return (
    <button type="button" onClick={onSelect} aria-pressed={on} className={`${base} ${CAT_CLASS[cat.category]} ${on ? "hq-catfill shadow-none!" : "bg-surface-2 text-fg-2"}`}>
      {!on && <i aria-hidden="true" className="size-2 rounded-full bg-[var(--cat)]" />}
      <b className="font-extrabold tracking-[-0.02em]">{SET_CATEGORY_LABEL[cat.category]}</b>
      <span className={`font-mono text-[12px] font-bold tabular-nums ${on ? "opacity-85" : "text-muted"}`}>
        {cat.passed}/{cat.total}
      </span>
    </button>
  );
}

/** 세트 한 단원: 분류색 배너(세트 영역 안에서 위에 붙음)와 사인파 노드 경로, 옆 장면 */
function SetUnit({ sp, index, bubble }: { sp: SetPath; index: number; bubble: string }) {
  const { set, nodes } = sp;
  const { kicker, name } = splitSetTitle(set.title, set.category);
  const flip = index % 2 ? -1 : 1;
  const si = sceneIndex(nodes.length);
  const art = sceneFor(set.category, index);
  return (
    <section className={`${CAT_CLASS[set.category]} pb-6`} aria-labelledby={`set-${set.id}`}>
      <div className="sticky top-[env(safe-area-inset-top)] z-20 -mx-1 bg-bg px-1 pt-2 pb-1">
        <div className={`hq-catfill flex min-h-[78px] items-center gap-3 rounded-[18px] py-3 pr-3 pl-4`}>
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-bold tracking-[0.01em] opacity-85">
              {kicker} · <span className="font-mono tabular-nums">{sp.passed}/{sp.total}</span>
            </p>
            <h2 id={`set-${set.id}`} className="mt-0.5 text-[21px] leading-tight font-extrabold tracking-[-0.03em] [word-break:keep-all]">
              {name}
            </h2>
          </div>
          <Link href={`/sets/${set.id}`} className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-[12px] bg-white/18 px-3 text-[13.5px] font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:bg-black/18">
            <Icon name="mcq" size={17} strokeWidth={2.2} />
            문제 목록
          </Link>
        </div>
      </div>
      <ol className="relative mt-7 flex flex-col items-center [--amp:72px] sm:[--amp:96px]">
        {nodes.map((n, i) => {
          const cur = n.state === "cur";
          return (
            <li key={n.problem.id} className={`relative flex w-full flex-col items-center ${cur ? "pt-[54px] pb-4" : "py-[13px]"}`}>
              {i === si && <PathScene art={art} colored={n.state === "done"} side={(WAVE[i % WAVE.length] * flip > 0 ? -1 : 1) as -1 | 1} />}
              <div className="relative z-10 flex flex-col items-center pb-[9px]" style={{ translate: `calc(${WAVE[i % WAVE.length] * flip} * var(--amp)) 0` } as CSSProperties}>
                <PathNode state={n.state} category={set.category} icon={FORMAT_ICON[n.problem.format]} size={64} href={`/problems/${n.problem.id}`} label={n.problem.title} bubble={bubble} />
                {cur && (
                  <p className="mt-4 w-max max-w-[170px] text-center text-[12.5px] leading-[1.4] font-semibold text-muted [word-break:keep-all]">
                    <b className="block text-[13.5px] font-bold text-fg">{n.problem.title}</b>
                    {nodeMeta(n)}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function ArchiveList({ sets }: { sets: PathSet[] }) {
  return (
    <ul className="mt-3 space-y-3">
      {sets.map((s) => (
        <li key={s.id}>
          <Link href={`/sets/${s.id}`} className="hq-card flex items-center gap-3.5 p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
            <PathNode state="lock" category="archive" size={44} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-extrabold tracking-[-0.02em]">{splitSetTitle(s.title, s.category).name}</span>
              <span className="block truncate text-[12.5px] font-medium text-muted">{s.description}</span>
            </span>
            <span className="shrink-0 font-mono text-xs font-bold text-muted">{s.problemCount}문제</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** 이 탭(세션) 안에서 고른 분류와 스크롤 위치. 새로고침·다른 탭에서 돌아와도 이어 보인다 */
const VIEW_KEY = "hq:practice:view";
type SavedView = { cat: SetCategory | null; y: number | null };
const viewListeners = new Set<() => void>();
let viewRaw: string | null = null;
const readViewRaw = () => {
  try {
    viewRaw = sessionStorage.getItem(VIEW_KEY);
  } catch {
    viewRaw = null;
  }
  return viewRaw;
};
const parseView = (raw: string | null): SavedView => {
  try {
    return { cat: null, y: null, ...(JSON.parse(raw ?? "{}") as Partial<SavedView>) };
  } catch {
    return { cat: null, y: null };
  }
};
const writeView = (patch: Partial<SavedView>) => {
  const next = JSON.stringify({ ...parseView(viewRaw ?? readViewRaw()), ...patch });
  viewRaw = next;
  try {
    sessionStorage.setItem(VIEW_KEY, next);
  } catch {
    // 저장할 수 없는 환경에서도 이 화면 안에서는 선택이 유지된다
  }
  if (patch.cat !== undefined) viewListeners.forEach((l) => l());
};
const subscribeView = (l: () => void) => {
  viewListeners.add(l);
  return () => viewListeners.delete(l);
};
const noSubscribe = () => () => {};

/** 연습 탭: 상태 줄, 분류 칩, 선택한 분류의 세트별 배너와 사인파 경로. 순서는 권장만이라 모두 열려 있고 잠김은 비공개 분류뿐이다 */
export function PracticeView({ sets }: { sets: PathSet[] }) {
  const { categories } = usePath(sets);
  const hydrated = useSyncExternalStore(noSubscribe, () => true, () => false);
  const picked = parseView(useSyncExternalStore(subscribeView, () => viewRaw ?? readViewRaw(), () => null)).cat;
  const selected = categories.find((c) => c.category === picked) ?? categories.find((c) => !c.locked && c.current) ?? categories.find((c) => !c.locked) ?? categories[0];
  const cur = selected && !selected.locked ? selected.current : null;
  const started = !!selected && selected.sets.some((s) => s.nodes.some((n) => n.progress));
  const curId = cur && cur.set.id !== selected?.sets[0]?.set.id ? cur.problem.id : null;

  /** 세션 첫 방문에만 지금 노드를 가운데로, 그 뒤로는 저장한 위치로. 다른 화면에서 돌아와 다시 보일 때마다 실행된다 */
  useLayoutEffect(() => {
    if (!hydrated) return;
    const { y } = parseView(readViewRaw());
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => writeView({ y: window.scrollY }));
    };
    // 라우터가 이동 직후 맨 위로 올리는 것보다 뒤에 맞추려고 다음 프레임에 둔다
    const restore = requestAnimationFrame(() => {
      if (y !== null) window.scrollTo(0, y);
      else if (curId) document.querySelector(`a[href="/problems/${curId}"][aria-current="step"]`)?.scrollIntoView({ block: "center" });
      writeView({ y: window.scrollY });
      window.addEventListener("scroll", onScroll, { passive: true });
    });
    return () => {
      cancelAnimationFrame(restore);
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
    // 지금 노드가 바뀌어도(문제를 풀고 돌아와도) 다시 맞추지 않는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  return (
    <div className="w-full overflow-x-clip">
      <div className="mx-auto w-full max-w-[560px] px-5 pt-1 pb-8 lg:pt-6">
        <StatusLine />
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pt-1 pb-2 [scrollbar-width:none]">
          {categories.map((c) => (
            <CategoryChip key={c.category} cat={c} on={c.category === selected?.category} onSelect={() => writeView({ cat: c.category })} />
          ))}
        </div>
        {selected?.locked ? (
          <ArchiveList sets={selected.sets.map((s) => s.set)} />
        ) : (
          selected?.sets.map((s, i) => <SetUnit key={s.set.id} sp={s} index={i} bubble={started ? "이어서" : "시작"} />)
        )}
      </div>
    </div>
  );
}
