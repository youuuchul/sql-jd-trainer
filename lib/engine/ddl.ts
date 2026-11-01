import type { Cell, ColumnType, Dialect, SchemaDef, SeedTable } from "@/lib/content/types";

const TYPE_MAP: Record<Dialect, Record<ColumnType, string>> = {
  postgres: { int: "INTEGER", bigint: "BIGINT", decimal: "NUMERIC(18,2)", text: "TEXT", date: "DATE", timestamp: "TIMESTAMP", bool: "BOOLEAN" },
  bigquery: { int: "INTEGER", bigint: "BIGINT", decimal: "DECIMAL(18,2)", text: "VARCHAR", date: "DATE", timestamp: "TIMESTAMP", bool: "BOOLEAN" },
  mysql: { int: "INT", bigint: "BIGINT", decimal: "DECIMAL(18,2)", text: "VARCHAR(255)", date: "DATE", timestamp: "DATETIME", bool: "BOOLEAN" },
};

const quoteId = (dialect: Dialect, id: string): string => (dialect === "mysql" ? `\`${id}\`` : `"${id}"`);

const literal = (dialect: Dialect, v: Cell, type: ColumnType): string => {
  if (v === null) return "NULL";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
  let s = v.replace(/'/g, "''");
  if (dialect === "mysql") s = s.replace(/\\/g, "\\\\");
  if (dialect === "postgres" && (type === "date" || type === "timestamp")) return `'${s}'::${TYPE_MAP.postgres[type]}`;
  return `'${s}'`;
};

export const tableDdl = (dialect: Dialect, table: SeedTable): string[] => {
  const q = (id: string) => quoteId(dialect, id);
  const cols = table.columns.map((c) => `${q(c.name)} ${TYPE_MAP[dialect][c.type]}`).join(", ");
  const stmts = [`DROP TABLE IF EXISTS ${q(table.name)}`, `CREATE TABLE ${q(table.name)} (${cols})`];
  if (table.rows.length) {
    const names = table.columns.map((c) => q(c.name)).join(", ");
    const chunk = 200;
    for (let i = 0; i < table.rows.length; i += chunk) {
      const values = table.rows
        .slice(i, i + chunk)
        .map((row) => `(${row.map((v, idx) => literal(dialect, v, table.columns[idx].type)).join(", ")})`)
        .join(",\n");
      stmts.push(`INSERT INTO ${q(table.name)} (${names}) VALUES\n${values}`);
    }
  }
  return stmts;
};

export const schemaDdl = (dialect: Dialect, schema: SchemaDef): string[] => schema.tables.flatMap((t) => tableDdl(dialect, t));

/** 시드 내용이 바뀌면 값이 바뀐다. 원격 엔진의 재적재 판단에 쓴다. */
export const schemaVersion = (schema: SchemaDef): string => {
  const text = JSON.stringify(schema.tables);
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
};
