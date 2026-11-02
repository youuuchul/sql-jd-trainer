import type { Cell } from "@/lib/content/types";

const pad = (n: number) => String(n).padStart(2, "0");

export const formatDateUtc = (d: Date): string => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

export const formatTimestampUtc = (d: Date): string => {
  const base = `${formatDateUtc(d)} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
  const ms = d.getUTCMilliseconds();
  return ms ? `${base}.${String(ms).padStart(3, "0")}` : base;
};

/** 엔진별 값 객체를 공통 Cell로 바꾼다. bigint는 안전 범위면 number, 아니면 문자열. */
export const toCell = (v: unknown, kind?: "date" | "timestamp"): Cell => {
  if (v === null || v === undefined) return null;
  if (typeof v === "bigint") return v <= BigInt(Number.MAX_SAFE_INTEGER) && v >= BigInt(Number.MIN_SAFE_INTEGER) ? Number(v) : v.toString();
  if (typeof v === "number" || typeof v === "boolean") return v;
  if (v instanceof Date) return kind === "date" ? formatDateUtc(v) : formatTimestampUtc(v);
  if (typeof v === "string") return v;
  if (typeof v === "object" && v !== null && "toString" in v) return String(v);
  return JSON.stringify(v);
};
