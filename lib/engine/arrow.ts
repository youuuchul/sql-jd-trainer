import type { Cell } from "@/lib/content/types";
import type { Table } from "apache-arrow";
import { formatDateUtc, formatTimestampUtc, toCell } from "./format";
import { MAX_ROWS, type QueryResult } from "./types";

/** Arrow Decimal은 스케일 없는 정수(BN 객체 또는 32비트 워드 배열)로 온다. 정수로 복원한 뒤 scale을 적용한다. */
const decimalToNumber = (raw: unknown, scale: number): number => {
  let v: bigint;
  if (raw instanceof Uint32Array || raw instanceof Int32Array) {
    v = BigInt(0);
    for (let i = raw.length - 1; i >= 0; i--) v = (v << BigInt(32)) | BigInt(raw[i] >>> 0);
    const bits = BigInt(raw.length * 32);
    if (v >> (bits - BigInt(1))) v -= BigInt(1) << bits;
  } else if (typeof raw === "bigint") v = raw;
  else v = BigInt(String(raw));
  if (scale === 0) return Number(v);
  const neg = v < 0;
  const abs = neg ? -v : v;
  const div = BigInt(10) ** BigInt(scale);
  const n = Number(abs / div) + Number(abs % div) / Number(div);
  return neg ? -n : n;
};

export const arrowToResult = (table: Table, ms: number, maxRows = MAX_ROWS): QueryResult => {
  const fields = table.schema.fields;
  const columns = fields.map((f) => f.name);
  const total = table.numRows;
  const rows: Cell[][] = [];
  const limit = Math.min(total, maxRows);
  const vectors = columns.map((_, i) => table.getChildAt(i));
  for (let r = 0; r < limit; r++) {
    const row: Cell[] = [];
    for (let c = 0; c < columns.length; c++) {
      const raw = vectors[c]?.get(r);
      const type = fields[c].type;
      const typeName = String(type);
      if (raw === null || raw === undefined) row.push(null);
      else if (/^Decimal/.test(typeName)) {
        row.push(decimalToNumber(raw, (type as { scale?: number }).scale ?? 0));
      } else if (/^Date/.test(typeName)) {
        row.push(formatDateUtc(raw instanceof Date ? raw : new Date(Number(raw))));
      } else if (/^Timestamp/.test(typeName)) {
        // apache-arrow JS는 단위와 무관하게 epoch ms(number)로 돌려준다. bigint면 단위를 보고 환산한다.
        const unit = (type as { unit?: number }).unit;
        const msValue =
          typeof raw === "bigint" ? Number(raw) / (unit === 0 ? 0.001 : unit === 2 ? 1000 : unit === 3 ? 1e6 : 1) : raw instanceof Date ? raw.getTime() : Number(raw);
        row.push(formatTimestampUtc(new Date(msValue)));
      } else row.push(toCell(raw));
    }
    rows.push(row);
  }
  return { columns, rows, ms, truncated: total > maxRows };
};
