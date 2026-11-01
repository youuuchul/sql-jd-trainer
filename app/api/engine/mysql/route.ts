import { getSchema } from "@/lib/content/loader";
import { healthCheck, mysqlConfigured, runReadOnly } from "@/lib/engine/mysql-server";

const MAX_SQL_LENGTH = 20000;

export async function GET() {
  if (!mysqlConfigured()) return Response.json({ ok: false, error: "MySQL 엔진이 아직 연결되지 않았습니다. PostgreSQL 또는 BigQuery 모드를 사용하세요." }, { status: 503 });
  try {
    await healthCheck();
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!mysqlConfigured()) return Response.json({ error: "MySQL 엔진이 아직 연결되지 않았습니다." }, { status: 503 });
  let body: { schemaId?: string; sql?: string };
  try {
    body = (await request.json()) as { schemaId?: string; sql?: string };
  } catch {
    return Response.json({ error: "요청 본문이 JSON이 아닙니다." }, { status: 400 });
  }
  const { schemaId, sql } = body;
  if (typeof schemaId !== "string" || typeof sql !== "string") return Response.json({ error: "schemaId와 sql이 필요합니다." }, { status: 400 });
  if (sql.length > MAX_SQL_LENGTH) return Response.json({ error: "쿼리가 너무 깁니다." }, { status: 413 });
  const schema = getSchema(schemaId);
  if (!schema) return Response.json({ error: "알 수 없는 스키마입니다." }, { status: 404 });
  try {
    const result = await runReadOnly(schema, sql);
    return Response.json(result);
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }
}
