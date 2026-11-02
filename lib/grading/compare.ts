import type { Cell, Expected } from "@/lib/content/types";
import type { QueryResult } from "@/lib/engine/types";

export interface Mismatch {
  kind: "column-count" | "column-names" | "row-count" | "rows" | "order";
  message: string;
}

export interface CompareResult {
  pass: boolean;
  mismatches: Mismatch[];
  expectedRows: number;
  actualRows: number;
  /** 기대 결과에는 있는데 사용자 결과에 없는 행(표본) */
  missing: Cell[][];
  /** 사용자 결과에만 있는 행(표본) */
  extra: Cell[][];
}

const SAMPLE = 5;

const normalizeCell = (v: Cell): Cell => {
  if (v === null) return null;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v;
  const s = v.trim();
  if (s === "") return "";
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  if (/^(true|false)$/i.test(s)) return s.toLowerCase() === "true";
  // '2024-01-01 00:00:00' 과 '2024-01-01' 을 같은 값으로 본다.
  const m = s.match(/^(\d{4}-\d{2}-\d{2})[ T]00:00:00(\.0+)?$/);
  if (m) return m[1];
  return s.replace(/\.0+$/, "");
};

const cellEqual = (a: Cell, b: Cell, tol: number): boolean => {
  const x = normalizeCell(a);
  const y = normalizeCell(b);
  if (x === null || y === null) return x === y;
  if (typeof x === "number" && typeof y === "number") return Math.abs(x - y) <= Math.max(tol, Math.abs(y) * 1e-9);
  if (typeof x === "boolean" || typeof y === "boolean") return Number(x) === Number(y);
  return String(x) === String(y);
};

const rowEqual = (a: Cell[], b: Cell[], tol: number): boolean => a.length === b.length && a.every((v, i) => cellEqual(v, b[i], tol));

export const compareResult = (expected: Expected, actual: QueryResult): CompareResult => {
  const mismatches: Mismatch[] = [];
  const tol = expected.tolerance;
  const base: Omit<CompareResult, "pass" | "mismatches"> = { expectedRows: expected.rows.length, actualRows: actual.rows.length, missing: [], extra: [] };

  if (expected.columns.length !== actual.columns.length) {
    mismatches.push({ kind: "column-count", message: `컬럼 수가 다릅니다. 기대 ${expected.columns.length}개, 결과 ${actual.columns.length}개.` });
    return { pass: false, mismatches, ...base };
  }
  if (expected.checkColumnNames) {
    const bad = expected.columns.filter((c, i) => c.toLowerCase() !== (actual.columns[i] ?? "").toLowerCase());
    if (bad.length) mismatches.push({ kind: "column-names", message: `컬럼 이름이 다릅니다. 기대: ${expected.columns.join(", ")}` });
  }

  if (expected.ordered) {
    const n = Math.max(expected.rows.length, actual.rows.length);
    let firstDiff = -1;
    for (let i = 0; i < n; i++) {
      const e = expected.rows[i];
      const a = actual.rows[i];
      if (!e || !a || !rowEqual(e, a, tol)) {
        firstDiff = i;
        break;
      }
    }
    if (firstDiff !== -1) {
      const unorderedMissing = multisetDiff(expected.rows, actual.rows, tol);
      const sameSet = unorderedMissing.missing.length === 0 && unorderedMissing.extra.length === 0;
      if (sameSet) mismatches.push({ kind: "order", message: `행 집합은 같지만 정렬 순서가 다릅니다. ${firstDiff + 1}번째 행부터 어긋납니다.` });
      else {
        if (expected.rows.length !== actual.rows.length) mismatches.push({ kind: "row-count", message: `행 수가 다릅니다. 기대 ${expected.rows.length}행, 결과 ${actual.rows.length}행.` });
        mismatches.push({ kind: "rows", message: `${firstDiff + 1}번째 행부터 값이 다릅니다.` });
      }
      return { pass: false, mismatches, ...base, missing: unorderedMissing.missing.slice(0, SAMPLE), extra: unorderedMissing.extra.slice(0, SAMPLE) };
    }
    return { pass: mismatches.length === 0, mismatches, ...base };
  }

  const diff = multisetDiff(expected.rows, actual.rows, tol);
  if (expected.rows.length !== actual.rows.length) mismatches.push({ kind: "row-count", message: `행 수가 다릅니다. 기대 ${expected.rows.length}행, 결과 ${actual.rows.length}행.` });
  if (diff.missing.length || diff.extra.length) mismatches.push({ kind: "rows", message: `기대와 다른 행이 있습니다. 누락 ${diff.missing.length}행, 초과 ${diff.extra.length}행.` });
  return { pass: mismatches.length === 0, mismatches, ...base, missing: diff.missing.slice(0, SAMPLE), extra: diff.extra.slice(0, SAMPLE) };
};

const multisetDiff = (expected: Cell[][], actual: Cell[][], tol: number): { missing: Cell[][]; extra: Cell[][] } => {
  const used = new Array<boolean>(actual.length).fill(false);
  const missing: Cell[][] = [];
  for (const e of expected) {
    let found = -1;
    for (let i = 0; i < actual.length; i++) {
      if (!used[i] && rowEqual(e, actual[i], tol)) {
        found = i;
        break;
      }
    }
    if (found === -1) missing.push(e);
    else used[found] = true;
  }
  const extra = actual.filter((_, i) => !used[i]);
  return { missing, extra };
};

/** actual 행 중 expected 다중집합에 없는 행의 인덱스. */
export const multisetExtraIndexes = (expected: Cell[][], actual: Cell[][], tol: number): number[] => {
  const used = new Array<boolean>(actual.length).fill(false);
  for (const e of expected) {
    const i = actual.findIndex((a, idx) => !used[idx] && rowEqual(e, a, tol));
    if (i !== -1) used[i] = true;
  }
  return actual.map((_, i) => i).filter((i) => !used[i]);
};

/** 오답 패턴 대조용. 정규화한 행을 정렬해 해시한다. */
export const resultHash = (result: { columns: string[]; rows: Cell[][] }): string => {
  const lines = result.rows.map((r) => r.map((v) => JSON.stringify(normalizeCell(v))).join("\u0001")).sort();
  const text = `${result.columns.length}\u0002${lines.join("\u0003")}`;
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
};
