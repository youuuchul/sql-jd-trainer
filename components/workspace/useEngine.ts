"use client";
import { useCallback, useEffect, useState } from "react";
import type { Dialect, SchemaDef } from "@/lib/content/types";
import { getEngine, QueryError, type QueryResult } from "@/lib/engine";

export type EngineStatus = { state: "loading" | "ready" | "error"; message?: string };

/** 방언별 엔진을 백그라운드로 준비하고 스키마를 적재한다. */
export const useEngine = (dialect: Dialect, schema: SchemaDef) => {
  const key = `${dialect}:${schema.id}`;
  const [done, setDone] = useState<{ key: string; error?: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const engine = await getEngine(dialect);
        await engine.ready();
        await engine.load(schema);
        if (!cancelled) setDone({ key });
      } catch (err) {
        if (!cancelled) setDone({ key, error: err instanceof Error ? err.message : String(err) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dialect, schema, key]);

  const status: EngineStatus = done?.key !== key ? { state: "loading" } : done.error ? { state: "error", message: done.error } : { state: "ready" };

  const run = useCallback(
    async (sql: string): Promise<QueryResult> => {
      const engine = await getEngine(dialect);
      await engine.load(schema);
      try {
        return await engine.run(sql);
      } catch (err) {
        if (err instanceof QueryError) throw err;
        throw new QueryError(err instanceof Error ? err.message : String(err), dialect);
      }
    },
    [dialect, schema],
  );

  return { status, run };
};
