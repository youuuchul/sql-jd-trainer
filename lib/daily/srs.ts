import { UI_DIALECTS, type Card, type Dialect } from "@/lib/content/types";

/** 상자별 다음 복습까지 간격(분). 0번 상자는 틀린 카드로 5분 뒤 다시 나온다. */
export const BOX_INTERVAL_MIN = [5, 60 * 24, 60 * 24 * 3, 60 * 24 * 7, 60 * 24 * 14, 60 * 24 * 30] as const;
export const MAX_BOX = BOX_INTERVAL_MIN.length - 1;
/** 이 상자 이상이면 익힌 카드로 센다 */
export const MASTERED_BOX = 3;

export interface CardState {
  box: number;
  /** 다음 복습 시각(ms) */
  due: number;
  reps: number;
  lapses: number;
  lastAt: number;
}

export type Outcome = "correct" | "hinted" | "wrong";

export const schedule = (prev: CardState | undefined, outcome: Outcome, now: number): CardState => {
  const box = prev?.box ?? 0;
  const nextBox = outcome === "correct" ? Math.min(box + 1, MAX_BOX) : outcome === "hinted" ? Math.max(box, 1) : 0;
  return {
    box: nextBox,
    due: now + BOX_INTERVAL_MIN[nextBox] * 60000,
    reps: (prev?.reps ?? 0) + 1,
    lapses: (prev?.lapses ?? 0) + (outcome === "wrong" ? 1 : 0),
    lastAt: now,
  };
};

export type DialectFilter = "all" | Dialect;

export const matchesDialect = (card: Pick<Card, "dialect">, filter: DialectFilter): boolean =>
  filter === "all" || card.dialect === "common" || card.dialect === filter;

const seededShuffle = <T,>(items: T[], seedText: string): T[] => {
  let seed = 0;
  for (const ch of seedText) seed = (Math.imul(seed, 31) + ch.charCodeAt(0)) | 0;
  const next = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

/** 새 카드는 이 장수마다 응용 카드 한 장이 들어간다(4장 중 1장). 나머지는 자주 쓰는 카드이고, 한쪽이 떨어지면 남은 쪽으로 채운다 */
export const APPLIED_EVERY = 4;

const mixByLevel = <T extends Card>(cards: T[]): T[] => {
  const core = cards.filter((c) => c.level !== "applied");
  const applied = cards.filter((c) => c.level === "applied");
  const out: T[] = [];
  while (core.length || applied.length) {
    const appliedSlot = (out.length + 1) % APPLIED_EVERY === 0;
    const takeApplied = applied.length > 0 && (appliedSlot || core.length === 0);
    out.push((takeApplied ? applied : core).shift()!);
  }
  return out;
};

/**
 * 오늘 풀 카드. 복습 시각이 지난 카드를 먼저(오래된 순), 남는 자리는 처음 보는 카드를 날짜 시드로 섞어 채운다.
 * 처음 보는 카드는 자주 쓰는 카드 위주로, 응용 카드는 APPLIED_EVERY 장마다 한 장씩 섞는다.
 * 같은 날에는 같은 순서가 나오도록 seedText 에 날짜를 넣는다.
 */
export const buildQueue = <T extends Card>(
  cards: T[],
  states: Record<string, CardState>,
  opts: { now: number; size: number; filter: DialectFilter; seedText: string; exclude?: Set<string> },
): T[] => {
  const pool = cards.filter((c) => matchesDialect(c, opts.filter) && !opts.exclude?.has(c.id));
  const due = pool.filter((c) => states[c.id] && states[c.id].due <= opts.now).sort((a, b) => states[a.id].due - states[b.id].due);
  const fresh = mixByLevel(
    seededShuffle(
      pool.filter((c) => !states[c.id]),
      opts.seedText,
    ),
  );
  return [...due, ...fresh].slice(0, Math.max(opts.size, 0));
};

const BLANK = "___";
const norm = (s: string, caseSensitive: boolean) => {
  const v = s.trim().replace(/\s+/g, " ");
  return caseSensitive ? v : v.toLowerCase();
};
const stripQuotes = (s: string) => s.trim().replace(/^(['"`])(.*)\1$/, "$2");

/** 빈칸이 이미 따옴표로 감싸져 있으면 입력의 따옴표는 벗겨서도 비교한다 */
export const isCorrect = (card: Pick<Card, "template" | "answers" | "caseSensitive">, input: string): boolean => {
  const i = card.template.indexOf(BLANK);
  const before = card.template[i - 1];
  const after = card.template[i + BLANK.length];
  const quoted = before !== undefined && before === after && `'"\``.includes(before);
  const candidates = quoted ? [input, stripQuotes(input)] : [input];
  return card.answers.some((a) => candidates.some((c) => norm(c, card.caseSensitive) === norm(a, card.caseSensitive)));
};

/** 정답 후보가 이 글자 수 이하면 앞글자 힌트가 곧 정답이라 건너뛴다 */
export const FIRST_LETTER_MIN_LEN = 3;

/** 힌트 글에 정답 후보가 그대로 들어 있으면 ___ 로 가린다(대소문자 무시, 영숫자 경계) */
export const maskAnswers = (text: string, answers: string[]): string =>
  [...answers]
    .filter((a) => a.trim())
    .sort((a, b) => b.length - a.length)
    .reduce((acc, a) => acc.replace(new RegExp(`(?<![A-Za-z0-9_])${a.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![A-Za-z0-9_])`, "gi"), BLANK), text);

/** 로컬 날짜 키 YYYY-MM-DD */
export const dayKey = (t: number): string => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** 목표를 채운 날이 오늘(또는 오늘 아직이면 어제)부터 며칠 이어졌는지 */
export const streak = (completedDays: Set<string>, now: number): number => {
  let t = now;
  if (!completedDays.has(dayKey(t))) t -= 86400000;
  let n = 0;
  while (completedDays.has(dayKey(t))) {
    n++;
    t -= 86400000;
  }
  return n;
};

/** 복습 상자 번호의 간격 이름(사다리 눈금·칩용). 0 → 5분, 1 → 1일 … */
export const intervalLabel = (box: number): string => {
  const min = BOX_INTERVAL_MIN[Math.min(Math.max(box, 0), MAX_BOX)];
  return min < 60 ? `${min}분` : `${min / (60 * 24)}일`;
};

/** 화면에 내지 않는 방언(MySQL)의 카드는 출제·집계에서 뺀다. 콘텐츠와 저장값은 그대로 둔다 */
export const isShown = (card: Pick<Card, "dialect" | "extra">): boolean => !card.extra && (card.dialect === "common" || UI_DIALECTS.includes(card.dialect));

const editDistance = (a: string, b: string): number => {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
};

/** 입력이 정답 후보와 몇 글자 다른지(후보 중 최솟값). 비교 규칙은 isCorrect 와 같다 */
export const answerDistance = (card: Pick<Card, "template" | "answers" | "caseSensitive">, input: string): number => {
  const i = card.template.indexOf(BLANK);
  const before = card.template[i - 1];
  const after = card.template[i + BLANK.length];
  const quoted = before !== undefined && before === after && `'"\``.includes(before);
  const candidates = quoted ? [input, stripQuotes(input)] : [input];
  return Math.min(...card.answers.flatMap((a) => candidates.map((c) => editDistance(norm(c, card.caseSensitive), norm(a, card.caseSensitive)))));
};

/** now 가 속한 주(월~일)의 요일 라벨·날짜 키 */
export const weekOf = (now: number): { key: string; label: string; today: boolean }[] => {
  const labels = ["월", "화", "수", "목", "금", "토", "일"];
  const d = new Date(now);
  const mondayOffset = (d.getDay() + 6) % 7;
  return labels.map((label, i) => {
    const t = new Date(d.getFullYear(), d.getMonth(), d.getDate() - mondayOffset + i, 12).getTime();
    return { key: dayKey(t), label, today: i === mondayOffset };
  });
};
