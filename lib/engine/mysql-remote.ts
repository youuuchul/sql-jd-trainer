import type { SchemaDef } from "@/lib/content/types";
import { QueryError, type Engine, type QueryResult } from "./types";

/** MySQL은 브라우저 엔진이 없어 서버 Route Handler를 거친다. */
export class MysqlRemoteEngine implements Engine {
  readonly dialect = "mysql" as const;
  private schemaId: string | null = null;

  async ready(): Promise<void> {
    const res = await fetch("/api/engine/mysql", { method: "GET" });
    const body = (await res.json()) as { ok: boolean; error?: string };
    if (!body.ok) throw new QueryError(body.error ?? "MySQL 서버에 연결할 수 없습니다.", "mysql");
  }

  async load(schema: SchemaDef): Promise<void> {
    this.schemaId = schema.id;
  }

  async run(sql: string): Promise<QueryResult> {
    if (!this.schemaId) throw new QueryError("스키마가 선택되지 않았습니다.", "mysql");
    const res = await fetch("/api/engine/mysql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schemaId: this.schemaId, sql }),
    });
    const body = (await res.json()) as { error?: string } & Partial<QueryResult>;
    if (!res.ok || body.error) throw new QueryError(body.error ?? `HTTP ${res.status}`, "mysql");
    return { columns: body.columns ?? [], rows: body.rows ?? [], ms: body.ms ?? 0, truncated: body.truncated ?? false };
  }
}
