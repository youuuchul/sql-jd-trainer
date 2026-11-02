import type { SchemaDef } from "../lib/content/types";
import { runReadOnly } from "../lib/engine/mysql-core";
import type { QueryResult } from "../lib/engine/types";

/** MYSQL_URL이 있을 때만 쓴다. Route Handler와 같은 코어를 공유한다. */
export const createMysqlNode = () => ({
  run: (schema: SchemaDef, sql: string): Promise<QueryResult> => runReadOnly(schema, sql),
});
