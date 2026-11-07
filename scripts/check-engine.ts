/**
 * 엔진 격리·스크립트 실행기 확인. 실행마다 쓰기 문장이 되돌려져 다음 실행·다른 문제에 남지 않는지, 허용 문장 목록이 지켜지는지 본다.
 * 실행: npx tsx scripts/check-engine.ts
 */
import { ExpectedSchema, ProblemSchema, type Problem, type SchemaDef } from "../lib/content/types";
import type { ProbeOutcome, ScriptOptions, ScriptRun } from "../lib/engine/script";
import { gradeScript, scriptTargets } from "../lib/grading/script";
import { createDuckdbNode } from "./duckdb-node";
import { createPgliteNode } from "./pglite-node";

const schema: SchemaDef = {
  id: "check",
  title: "check",
  domain: "test",
  timezone: "Asia/Seoul",
  notes: [],
  metrics: [],
  locked: false,
  tables: [
    {
      name: "seed",
      columns: [
        { name: "d", type: "date" },
        { name: "v", type: "int" },
      ],
      rows: [
        ["2026-10-01", 1],
        ["2026-10-02", 2],
        ["2026-11-01", 3],
      ],
    },
  ],
};

type Runner = { run: (sql: string) => unknown };

let failures = 0;
const check = (label: string, ok: boolean, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "통과" : "실패"} ${label}${detail ? ` (${detail})` : ""}`);
};
const attempt = async (r: Runner, sql: string): Promise<{ rows?: unknown[][]; error?: string }> => {
  try {
    return { rows: ((await r.run(sql)) as { rows: unknown[][] }).rows };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
};

const isolation = async (name: string, r: Runner) => {
  await attempt(r, "DROP TABLE seed");
  const seed = await attempt(r, "SELECT COUNT(*) AS n FROM seed");
  check(`${name} 시드 DROP 뒤 다음 실행에서 시드가 그대로`, seed.rows?.[0]?.[0] === 3, JSON.stringify(seed));
  await attempt(r, "CREATE TABLE leak AS SELECT 1 AS x");
  const leak = await attempt(r, "SELECT * FROM leak");
  check(`${name} CREATE TABLE 이 다음 실행에 남지 않음`, Boolean(leak.error), JSON.stringify(leak));
  await attempt(r, "CREATE TEMP TABLE seed AS SELECT 99 AS z");
  const shadow = await attempt(r, "SELECT COUNT(*) AS n FROM seed");
  check(`${name} 시드 이름을 가리는 임시 테이블이 남지 않음`, shadow.rows?.[0]?.[0] === 3, JSON.stringify(shadow));
};

type ScriptRunner = { runScript: (sql: string, opts: ScriptOptions) => Promise<ScriptRun> };
const opts: ScriptOptions = { probes: [], columns: new Map(schema.tables.flatMap((t) => t.columns.map((c) => [c.name, t.name] as const))) };
const script = async (r: ScriptRunner, sql: string, probes: string[] = []): Promise<{ run?: ScriptRun; error?: string }> => {
  try {
    return { run: await r.runScript(sql, { ...opts, probes }) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
};

/** 스크립트 실행기: 허용 목록, 트랜잭션 탈출, 시드 복구, 실행 사이 상태 누수 */
const scripts = async (name: string, r: Runner & ScriptRunner, dialect: "postgres" | "bigquery") => {
  const blocked = ["BEGIN", "COMMIT", "ROLLBACK", "SAVEPOINT s1", "END", "DO $$ BEGIN END $$", "CALL p()", "COPY seed TO 'x.csv'", "ATTACH 'x.db'", "INSTALL httpfs", "LOAD httpfs", "PRAGMA version", "EXPORT DATABASE 'x'", "SET search_path = public", "START TRANSACTION", "ALTER TABLE seed ADD COLUMN z INT", "CREATE VIEW v AS SELECT 1"];
  for (const b of blocked) {
    const res = await script(r, `CREATE TEMP TABLE t1 AS SELECT * FROM seed;\n${b};\nSELECT 1`);
    check(`${name} 거부: ${b}`, Boolean(res.error) && /쓸 수 없|실행할 수 없|DECLARE 로 먼저/.test(res.error ?? ""), res.error?.slice(0, 80));
  }
  // 문자열·주석·달러 인용 안의 세미콜론과 COMMIT 은 문장이 아니다. 백슬래시는 이스케이프가 아니다
  const tricky = await script(r, "SELECT 'a;COMMIT' AS s; -- ; COMMIT\nSELECT $$b;COMMIT$$ AS s /* ; COMMIT */; SELECT 'c\\' AS s");
  check(`${name} 문자열·주석 안 세미콜론`, tricky.run?.log.length === 3, tricky.error ?? JSON.stringify(tricky.run?.log));
  const escape = await script(r, "SELECT 'x\\'; COMMIT; DROP TABLE seed; SELECT '");
  check(`${name} 백슬래시로 문자열을 늘려 COMMIT 을 숨겨도 거부`, Boolean(escape.error), escape.error?.slice(0, 80));
  const seedAfter = await attempt(r, "SELECT COUNT(*) FROM seed");
  check(`${name} 그 뒤 시드 그대로`, seedAfter.rows?.[0]?.[0] === 3, JSON.stringify(seedAfter));

  const pipe = await script(
    r,
    `CREATE TEMP TABLE stg AS SELECT * FROM seed WHERE v < 3;
     CREATE TABLE mart (d DATE, v INTEGER);
     INSERT INTO mart SELECT d, v FROM stg;
     DELETE FROM mart WHERE v = 1;
     UPDATE mart SET v = 20 WHERE v = 2;
     DROP TABLE seed;
     SELECT * FROM mart`,
    ["SELECT d, v FROM mart ORDER BY d", "SELECT * FROM nope"],
  );
  const log = pipe.run?.log.map((l) => `${l.kind}:${l.rows}`).join(",");
  check(`${name} 단계별 실행 기록`, log === "CREATE TABLE:2,CREATE TABLE:null,INSERT:2,DELETE:1,UPDATE:1,DROP TABLE:null,SELECT:1", pipe.error ?? log);
  check(`${name} 확인 조회 결과와 오류`, JSON.stringify(pipe.run?.probes[0].result?.rows) === JSON.stringify([["2026-10-02", 20]]) && Boolean(pipe.run?.probes[1].error), JSON.stringify(pipe.run?.probes));
  check(`${name} 만든 테이블 행 수`, JSON.stringify(pipe.run?.tables) === JSON.stringify({ stg: 2, mart: 1 }), JSON.stringify(pipe.run?.tables));
  const after = await attempt(r, "SELECT COUNT(*) FROM seed");
  const leak = await script(r, "SELECT COUNT(*) FROM mart");
  check(`${name} 스크립트 뒤 시드 복구·만든 테이블 사라짐`, after.rows?.[0]?.[0] === 3 && Boolean(leak.error), `${JSON.stringify(after)} ${leak.error?.slice(0, 60)}`);
  const failed = await script(r, "CREATE TABLE half AS SELECT 1 AS x;\nSELECT * FROM nope");
  const half = await script(r, "SELECT * FROM half");
  check(`${name} 중간 오류 문장 번호와 되돌림`, /2번째 문장\(2행/.test(failed.error ?? "") && Boolean(half.error), failed.error?.slice(0, 80));

  if (dialect === "bigquery") {
    const vars = await script(
      r,
      `DECLARE from_date, to_date DATE;
       DECLARE n INT64 DEFAULT 1;
       SET from_date = DATE '2026-10-01';
       SET to_date = DATE_ADD(from_date, INTERVAL 1 DAY);
       SELECT COUNT(*) + n AS c FROM seed WHERE d BETWEEN from_date AND to_date;
       SET to_date = DATE '2026-12-31';
       SELECT COUNT(*) AS to_date FROM seed WHERE d BETWEEN from_date AND to_date`,
    );
    check(`${name} DECLARE·SET 값 치환과 본문 중간 SET`, JSON.stringify(vars.run?.probes) === "[]" && vars.run?.last?.rows[0]?.[0] === 3 && vars.run?.last?.columns[0] === "to_date" && vars.run?.log[4].rows === 1, vars.error ?? JSON.stringify(vars.run?.last));
    const clash = await script(r, "DECLARE d DATE DEFAULT DATE '2026-10-01';\nSELECT COUNT(*) FROM seed WHERE d = d");
    check(`${name} 변수 이름이 컬럼과 겹치면 거부`, /seed\.d 컬럼과 겹칩니다/.test(clash.error ?? ""), clash.error?.slice(0, 80));
    const undeclared = await script(r, "SET x = 1;\nSELECT 1");
    check(`${name} 선언 안 한 SET 거부`, /DECLARE 로 먼저/.test(undeclared.error ?? ""), undeclared.error?.slice(0, 80));
    const v2 = await attempt(r, "SELECT getvariable('from_date')");
    check(`${name} 변수가 엔진에 남지 않음`, v2.rows?.[0]?.[0] === null || Boolean(v2.error), JSON.stringify(v2));
  } else {
    const declare = await script(r, "DECLARE c CURSOR FOR SELECT 1;\nSELECT 1");
    check(`${name} DECLARE 거부`, Boolean(declare.error), declare.error?.slice(0, 80));
  }
};

/** 채점: 머리 구획 바꿔 끼우기, 변수 바꿔 재실행, 본문 2회 실행, 진단 */
const grading = async (r: ScriptRunner) => {
  const head = (from: string, to: string) => `-- A. 변수 설정\nDECLARE from_date, to_date DATE;\nSET from_date = DATE '${from}';\nSET to_date = DATE '${to}';`;
  const body = (cond = "d BETWEEN from_date AND to_date") => `-- B. 쿼리문\nCREATE TEMP TABLE mart AS SELECT d, v FROM seed WHERE ${cond};\nSELECT COUNT(*) AS n FROM mart`;
  const solution = `${head("2026-10-01", "2026-10-31")}\n${body()}`;
  const base = ProblemSchema.parse({
    id: "check-script",
    schema: "check",
    title: "check",
    sourceType: "domain",
    format: "write",
    difficulty: "basic",
    prompt: "",
    solutions: { bigquery: solution },
    script: { probes: ["SELECT COUNT(*) AS n, SUM(v) AS s FROM mart"], variants: [{ label: "11월", head: { bigquery: head("2026-11-01", "2026-11-30") } }] },
  });
  const built = await scriptTargets(r.runScript, base, schema, solution);
  const vbuilt = await scriptTargets(r.runScript, base, schema, solution, base.script!.variants[0].head.bigquery);
  const table = (o: ProbeOutcome[]) => o.map((x) => ({ columns: x.result!.columns, rows: x.result!.rows }));
  const problem: Problem = { ...base, expected: ExpectedSchema.parse(table(built.outcomes)[0]), script: { ...base.script!, results: table(built.outcomes), tables: built.run.tables, variants: [{ ...base.script!.variants[0], results: table(vbuilt.outcomes) }] } };
  check("채점 기대 결과(기본 10월 2행 합 3, 변형 11월 1행 합 3)", JSON.stringify([problem.script!.results[0].rows, problem.script!.variants[0].results[0].rows]) === "[[[2,3]],[[1,3]]]", JSON.stringify(problem.script));

  const g = (sql: string, p = problem) => gradeScript(r.runScript, p, "bigquery", schema, sql);
  const ok = await g(solution);
  check("정답 스크립트 통과", ok.pass && !ok.headSwapped, JSON.stringify(ok.diagnoses));
  const swapped = await g(`${head("2026-10-02", "2026-10-31")}\n${body()}`);
  check("머리를 바꿔 실험해도 채점은 원본 머리로", swapped.pass && swapped.headSwapped && swapped.view.probes[0].result?.rows[0][0] === 1, JSON.stringify(swapped.view.probes));
  const hard = await g(`${head("2026-10-01", "2026-10-31")}\n${body("d BETWEEN DATE '2026-10-01' AND DATE '2026-10-31'")}`);
  check("본문에 날짜를 박으면 변형에서 오답", !hard.pass && hard.failedAt === "11월" && hard.diagnoses[0]?.label === "변수 바꿔 실행", JSON.stringify(hard.diagnoses));
  const noMark = await g(solution.replace("-- B. 쿼리문", "-- 쿼리문"));
  check("구획 표식을 지우면 진단", !noMark.pass && noMark.diagnoses[0]?.label === "구획 표식 확인", JSON.stringify(noMark.diagnoses));
  const wrongName = await g(solution.replace("CREATE TEMP TABLE mart", "CREATE TEMP TABLE mart2").replace("FROM mart", "FROM mart2"));
  check("확인 조회 테이블 없음 진단", !wrongName.pass && wrongName.diagnoses[0]?.label === "확인 조회 테이블 없음", JSON.stringify(wrongName.diagnoses));
  const fewer = await g(`${head("2026-10-01", "2026-10-31")}\n${body("d BETWEEN from_date AND to_date AND v > 1")}`);
  check("단계 행 수 진단", !fewer.pass && fewer.diagnoses[0]?.label === "단계 행 수", JSON.stringify(fewer.diagnoses));

  const twiceHead = `-- A. 변수 설정\nDECLARE run_date DATE;\nSET run_date = DATE '2026-10-02';\n-- A-2. 이미 적재된 마트\nCREATE TEMP TABLE mart AS SELECT d, v FROM seed WHERE d < DATE '2026-10-02';`;
  const twiceSol = `${twiceHead}\n-- B. 쿼리문\nDELETE FROM mart WHERE d = run_date;\nINSERT INTO mart SELECT d, v FROM seed WHERE d = run_date`;
  const tBase = ProblemSchema.parse({ ...base, id: "check-twice", solutions: { bigquery: twiceSol }, script: { probes: ["SELECT d, v FROM mart ORDER BY d"], runTwice: true } });
  const tBuilt = await scriptTargets(r.runScript, tBase, schema, twiceSol);
  const tProblem: Problem = { ...tBase, expected: ExpectedSchema.parse(table(tBuilt.outcomes)[0]), script: { ...tBase.script!, results: table(tBuilt.outcomes), tables: tBuilt.run.tables } };
  check("2회 실행 정답 통과", (await g(twiceSol, tProblem)).pass && tBuilt.outcomes[0].result?.rows.length === 2, JSON.stringify(tBuilt.outcomes));
  const dup = await g(twiceSol.replace("DELETE FROM mart WHERE d = run_date;\n", ""), tProblem);
  check("지우지 않고 넣으면 재실행 진단", !dup.pass && dup.diagnoses[0]?.label === "재실행하면 달라짐", JSON.stringify(dup.diagnoses));
};

const main = async () => {
  const pg = await createPgliteNode();
  await pg.load(schema);
  const duck = await createDuckdbNode();
  duck.load(schema);
  await isolation("PG", pg);
  await isolation("BQ", duck);
  await scripts("PG", pg, "postgres");
  await scripts("BQ", duck, "bigquery");
  await grading(duck);

  // BigQuery 주 단위: WEEK 는 일요일, WEEK(요일)은 그 요일, ISOWEEK 는 월요일 시작. 2026-11-07 은 토요일
  const week = await attempt(
    duck,
    "SELECT DATE_TRUNC(DATE '2026-11-07', WEEK), DATE_TRUNC(DATE '2026-11-07', WEEK(MONDAY)), DATE_TRUNC(DATE '2026-11-07', ISOWEEK), DATE_TRUNC(DATE '2026-11-07', WEEK(SATURDAY)), DATE_DIFF(DATE '2026-11-08', DATE '2026-10-31', WEEK)",
  );
  check("BQ 주 시작 요일과 주 차이", JSON.stringify(week.rows?.[0]) === JSON.stringify(["2026-11-01", "2026-11-02", "2026-11-02", "2026-11-07", 2]), JSON.stringify(week));
  duck.close();
  await pg.close();
  console.log(failures ? `\n실패 ${failures}건` : "\n모두 통과");
  process.exit(failures ? 1 : 0);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
