import mysql, { type Pool } from "mysql2/promise";
import type { Cell, SchemaDef } from "@/lib/content/types";
import { schemaDdl, schemaVersion } from "./ddl";
import { toCell } from "./format";
import { MAX_ROWS, type QueryResult } from "./types";
import { isReadOnly, singleStatement } from "./sql-utils";

const META_TABLE = "_sjt_meta";
const TIMEOUT_MS = 8000;

let pool: Pool | null = null;

export const mysqlConfigured = (): boolean => Boolean(process.env.MYSQL_URL);

const getPool = (): Pool => {
  if (pool) return pool;
  const url = process.env.MYSQL_URL;
  if (!url) throw new Error("MYSQL_URL이 설정되지 않았습니다.");
  pool = mysql.createPool({
    uri: url,
    connectionLimit: 3,
    multipleStatements: false,
    dateStrings: true,
    decimalNumbers: true,
    supportBigNumbers: true,
    bigNumberStrings: false,
    rowsAsArray: true,
    ssl: process.env.MYSQL_SSL === "1" ? { minVersion: "TLSv1.2", rejectUnauthorized: true } : undefined,
  });
  return pool;
};

export const dbName = (schemaId: string): string => `sjt_${schemaId.replace(/[^a-z0-9_]/gi, "_")}`;

const loading = new Map<string, Promise<void>>();

/** 스키마 버전이 같으면 건너뛰고, 다르면 테이블을 다시 만든다. */
export const ensureSchema = (schema: SchemaDef): Promise<void> => {
  const key = schema.id;
  const existing = loading.get(key);
  if (existing) return existing;
  const task = (async () => {
    const db = dbName(schema.id);
    const version = schemaVersion(schema);
    const conn = await getPool().getConnection();
    try {
      await conn.query(`CREATE DATABASE IF NOT EXISTS \`${db}\``);
      await conn.changeUser({ database: db });
      await conn.query(`CREATE TABLE IF NOT EXISTS \`${META_TABLE}\` (schema_id VARCHAR(64) PRIMARY KEY, version VARCHAR(32) NOT NULL)`);
      const [rows] = await conn.query<mysql.RowDataPacket[]>(`SELECT version FROM \`${META_TABLE}\` WHERE schema_id = ?`, [schema.id]);
      const current = (rows[0] as unknown as [string] | undefined)?.[0];
      if (current === version) return;
      for (const stmt of schemaDdl("mysql", schema)) await conn.query(stmt);
      await conn.query(`REPLACE INTO \`${META_TABLE}\` (schema_id, version) VALUES (?, ?)`, [schema.id, version]);
    } finally {
      conn.release();
    }
  })();
  loading.set(key, task);
  task.catch(() => loading.delete(key));
  return task;
};

export const healthCheck = async (): Promise<void> => {
  const conn = await getPool().getConnection();
  try {
    await conn.query("SELECT 1");
  } finally {
    conn.release();
  }
};

export const runReadOnly = async (schema: SchemaDef, sql: string): Promise<QueryResult> => {
  const stmt = singleStatement(sql);
  if (!isReadOnly(stmt)) throw new Error("SELECT 또는 WITH로 시작하는 조회 쿼리만 실행할 수 있습니다.");
  await ensureSchema(schema);
  const conn = await getPool().getConnection();
  const started = performance.now();
  try {
    await conn.changeUser({ database: dbName(schema.id) });
    await conn.query(`SET SESSION MAX_EXECUTION_TIME=${TIMEOUT_MS}`);
    await conn.query("SET SESSION TRANSACTION READ ONLY");
    await conn.query("SET SESSION sql_mode='STRICT_TRANS_TABLES,ONLY_FULL_GROUP_BY,NO_ENGINE_SUBSTITUTION'");
    const [rows, fields] = await conn.query<mysql.RowDataPacket[][]>({ sql: stmt, rowsAsArray: true });
    const all = rows as unknown as unknown[][];
    return {
      columns: (fields ?? []).map((f) => f.name),
      rows: all.slice(0, MAX_ROWS).map((r) => r.map((v) => toCell(v) as Cell)),
      ms: Math.round(performance.now() - started),
      truncated: all.length > MAX_ROWS,
    };
  } finally {
    conn.release();
  }
};
