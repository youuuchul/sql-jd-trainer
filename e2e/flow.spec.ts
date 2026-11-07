import { expect, test, type Page } from "@playwright/test";
import { ExpectedSchema, REVIEW_CATEGORY, type Problem, type ReviewCategory } from "../lib/content/types";
import { compareResult } from "../lib/grading/compare";
import { JD_MOCK_SET_KEY } from "../lib/jd/mock-set";
import { lockedSchemaIds, problem, problems, set } from "./content";
import { unlock } from "./helpers";

const setEditor = async (page: Page, sql: string) => {
  const content = page.locator(".cm-content");
  await content.click();
  await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await page.keyboard.press("Backspace");
  await page.keyboard.insertText(sql);
};

const waitReady = async (page: Page) => {
  await expect(page.getByText("준비됨")).toBeVisible({ timeout: 90_000 });
};

test("문제 풀이 흐름: PostgreSQL 정답·오답 진단·BigQuery·MySQL·진행 저장", async ({ page }) => {
  const p = problem("ba-01-where-in-compare");
  await page.goto("/practice");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("연습");
  await page.goto("/sets/basics-01-select-filter");
  await page.getByRole("link", { name: new RegExp(p.title) }).click();
  await expect(page).toHaveURL(new RegExp(`/problems/${p.id}`));

  // PostgreSQL (PGlite) 정답
  await waitReady(page);
  await setEditor(page, p.solutions!.postgres!);
  // 실행 단축키(Cmd/Ctrl+Enter)로 실행
  await page.keyboard.press(process.platform === "darwin" ? "Meta+Enter" : "Control+Enter");
  await expect(page.getByText("정답", { exact: true })).toBeVisible();
  await expect(page.getByText(new RegExp(`내 결과 ${p.expected!.rows.length}행`))).toBeVisible();
  await expect(page.getByRole("heading", { name: "해설" })).toBeVisible();

  // 오답 패턴 진단
  await setEditor(page, p.wrongPatterns[0].sql!.postgres!);
  await page.getByRole("button", { name: /실행/ }).click();
  await expect(page.getByText("오답", { exact: true })).toBeVisible();
  await expect(page.getByText(p.wrongPatterns[0].label).first()).toBeVisible();

  // 구문 오류 표시
  await setEditor(page, "SELECT * FROM nope_table");
  await page.getByRole("button", { name: /실행/ }).click();
  await expect(page.locator("pre", { hasText: /nope_table/ })).toBeVisible();

  // BigQuery (DuckDB-WASM + shim)
  await page.getByRole("radio", { name: "BigQuery" }).click();
  await waitReady(page);
  await setEditor(page, p.solutions!.bigquery!);
  await page.getByRole("button", { name: /실행/ }).click();
  await expect(page.getByText("정답", { exact: true })).toBeVisible();

  // BigQuery 쓰기 문장은 실행마다 되돌린다: 시드를 지우고 테이블을 만들어도 다음 실행에 남지 않는다
  await setEditor(page, "DROP TABLE customers");
  await page.getByRole("button", { name: /실행/ }).click();
  await setEditor(page, "CREATE TABLE leak_check AS SELECT 1 AS x");
  await page.getByRole("button", { name: /실행/ }).click();
  await setEditor(page, "SELECT * FROM leak_check");
  await page.getByRole("button", { name: /실행/ }).click();
  await expect(page.locator("pre", { hasText: /leak_check/ })).toBeVisible();
  await setEditor(page, p.solutions!.bigquery!);
  await page.getByRole("button", { name: /실행/ }).click();
  await expect(page.getByText("정답", { exact: true })).toBeVisible();

  // MySQL (원격 Route Handler). 화면에서는 고를 수 없어 브라우저 엔진이 부르는 경로를 직접 부른다
  await expect(page.getByRole("radio", { name: "MySQL" })).toHaveCount(0);
  const mysql = (sql: string) => page.request.post("/api/engine/mysql", { data: { schemaId: p.schema, sql } });
  const solved = await mysql(p.solutions!.mysql!);
  expect(solved.ok(), await solved.text()).toBeTruthy();
  expect(compareResult(ExpectedSchema.parse(p.expected), await solved.json()).pass).toBe(true);
  const dropped = await mysql("DROP TABLE orders");
  expect(dropped.status()).toBe(400);
  expect((await dropped.json()).error).toMatch(/조회 쿼리만/);

  // 새로고침 후 방언·쿼리·통과 상태 유지
  await setEditor(page, "SELECT 1 AS keep_after_reload");
  await page.getByRole("button", { name: /실행/ }).click();
  await expect(page.getByText("오답", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("radio", { name: "BigQuery" })).toBeChecked();
  await expect(page.locator(".cm-content")).toContainText("keep_after_reload");
  await page.goto("/sets/basics-01-select-filter");
  const row = page.getByRole("link", { name: new RegExp(p.title) });
  await expect(row.getByText("통과")).toBeVisible();
});

test("작성 중인 쿼리: 실행하지 않아도 방언별로 저장돼 새로고침 후 남는다", async ({ page }) => {
  const p = problem("ba-01-where-in-compare");
  await page.goto(`/problems/${p.id}`);
  await waitReady(page);
  await setEditor(page, "SELECT 1 AS draft_pg");
  await page.waitForTimeout(900);
  await page.reload();
  await expect(page.locator(".cm-content")).toContainText("draft_pg");
  // 새로고침 직후 다시 새로고침해도 빈 값으로 덮이지 않는다
  await page.reload();
  await expect(page.locator(".cm-content")).toContainText("draft_pg");

  await page.getByRole("radio", { name: "BigQuery" }).click({ force: true });
  await waitReady(page);
  await setEditor(page, "SELECT 2 AS draft_bq");
  // 디바운스가 끝나기 전에 새로고침해도 마지막 입력이 남는다
  await page.reload();
  await expect(page.getByRole("radio", { name: "BigQuery" })).toBeChecked();
  await expect(page.locator(".cm-content")).toContainText("draft_bq");
  await page.getByRole("radio", { name: "PostgreSQL" }).click({ force: true });
  await expect(page.locator(".cm-content")).toContainText("draft_pg");
});

test("결과 표: 넓고 긴 결과가 표 영역 안에서 가로·세로로 스크롤되고, 정답일 때도 내 결과 표와 기대 결과가 보인다", async ({ page }) => {
  const p = problem("k-02-gmv-aov-monthly");
  await page.goto(`/problems/${p.id}`);
  await waitReady(page);
  await setEditor(page, "SELECT * FROM dim_member ORDER BY 1 LIMIT 40");
  await page.getByRole("button", { name: /실행/ }).click();
  await expect(page.getByText(/내 결과 40행/).first()).toBeVisible();

  const scroller = page.locator("table").first().locator("xpath=ancestor::div[contains(@class,'hq-scroll')][1]");
  const dims = await scroller.evaluate((el) => ({ ch: el.clientHeight, sh: el.scrollHeight, cw: el.clientWidth, sw: el.scrollWidth, oy: getComputedStyle(el).overflowY, ox: getComputedStyle(el).overflowX }));
  expect(dims.sh).toBeGreaterThan(dims.ch);
  expect(dims.sw).toBeGreaterThan(dims.cw);
  expect(dims.ch).toBeLessThanOrEqual(26 * 16);
  const box = (await scroller.boundingBox())!;
  await page.mouse.move(box.x + 80, box.y + 90);
  await page.mouse.wheel(0, 300);
  await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  await page.mouse.wheel(250, 0);
  await expect.poll(() => scroller.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
  // 오버레이 스크롤바가 숨지 않도록 스크롤바 두께가 지정돼 있다(헤드리스는 스크롤바를 그리지 않아 스타일 값으로 확인)
  expect(await scroller.evaluate((el) => getComputedStyle(el, "::-webkit-scrollbar").height)).toBe("12px");

  // 정답: 표 + 기대 결과 토글 유지
  await setEditor(page, p.solutions!.postgres!);
  await page.getByRole("button", { name: /실행/ }).click();
  await expect(page.getByText("정답", { exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: /^내 결과/ })).toBeVisible();
  await expect(page.locator("table").first()).toBeVisible();
  expect(await page.locator("table").first().evaluate((el) => el.getBoundingClientRect().height)).toBeGreaterThan(60);
  await page.getByRole("tab", { name: /^기대 결과/ }).click();
  await expect(page.getByRole("table", { name: "기대 결과" })).toBeVisible();
});

test("깨진 쿼리 고치기: 시작 쿼리가 채워지고 수정하면 정답", async ({ page }) => {
  const p = problem("ba-15-fix-not-equal-null");
  await page.goto(`/problems/${p.id}`);
  await waitReady(page);
  await expect(page.locator(".cm-content")).toContainText("SELECT");
  await page.getByRole("button", { name: /실행/ }).click();
  await expect(page.getByText("오답", { exact: true })).toBeVisible();
  await setEditor(page, p.solutions!.postgres!);
  await page.getByRole("button", { name: /실행/ }).click();
  await expect(page.getByText("정답", { exact: true })).toBeVisible();
});

test("파이프라인: 여러 문장 스크립트 정답·실행 기록·오답 진단·확인 조회 테이블 없음·BigQuery, 미리 쓴 줄 표시", async ({ page }) => {
  const p = problems().find((x) => x.script?.probes?.length && x.starterSql?.postgres && x.wrongPatterns.some((w) => w.sql?.postgres));
  test.skip(!p, "로컬 content 에 확인 조회가 있는 파이프라인 문제가 없습니다");
  const sol = p!.solutions!.postgres!;
  const table = Object.keys(p!.script!.tables).find((t) => p!.script!.probes[0].includes(t))!;
  await page.goto(`/problems/${p!.id}`);
  await waitReady(page);
  // 시작 쿼리의 미리 쓴 줄과 작성 자리 표시
  await expect(page.locator(".cm-prewritten").first()).toBeVisible();
  await expect(page.locator(".cm-writespot").first()).toBeVisible();

  await setEditor(page, sol);
  await page.getByRole("button", { name: /실행/ }).click();
  await expect(page.getByText("정답", { exact: true })).toBeVisible();
  await expect(page.getByText(new RegExp(`내 결과 ${p!.script!.results[0].rows.length}행`))).toBeVisible();
  await page.getByRole("tab", { name: /^실행 기록 \d+문장/ }).click();
  await expect(page.getByRole("table", { name: "문장별 실행 기록" }).getByText("CREATE TABLE").first()).toBeVisible();

  const wp = p!.wrongPatterns.find((w) => w.sql?.postgres)!;
  await setEditor(page, wp.sql!.postgres!);
  await page.getByRole("button", { name: /실행/ }).click();
  await expect(page.getByText("오답", { exact: true })).toBeVisible();
  await expect(page.getByText(wp.label).first()).toBeVisible();

  // 확인 조회가 읽는 테이블 이름을 바꾸면 진단
  await setEditor(page, sol.replaceAll(table, `${table}_x`));
  await page.getByRole("button", { name: /실행/ }).click();
  await expect(page.getByText("확인 조회 테이블 없음")).toBeVisible();

  // 트랜잭션 제어 문장은 거부
  await setEditor(page, `${sol}\n;\nCOMMIT`);
  await page.getByRole("button", { name: /실행/ }).click();
  await expect(page.locator("pre", { hasText: /트랜잭션 제어 문장은 쓸 수 없습니다/ })).toBeVisible();

  await page.getByRole("radio", { name: "BigQuery" }).click();
  await waitReady(page);
  await setEditor(page, p!.solutions!.bigquery!);
  await page.getByRole("button", { name: /실행/ }).click();
  await expect(page.getByText("정답", { exact: true })).toBeVisible();
});

test("파이프라인: 머리 변수를 바꿔 실험해도 원본 변수로 채점, 본문에 값을 박으면 변형 기준 오답", async ({ page }) => {
  const p = problems().find((x) => x.script?.variants?.length && /DATE '\d{4}-\d{2}-\d{2}' AS \w+/.test(x.solutions?.postgres ?? ""));
  test.skip(!p, "로컬 content 에 변형이 있는 파이프라인 문제가 없습니다");
  const sol = p!.solutions!.postgres!;
  const cut = sol.indexOf("-- B.");
  const [head, body] = [sol.slice(0, cut), sol.slice(cut)];
  const vars = [...head.matchAll(/DATE '(\d{4}-\d{2})-(\d{2})' AS (\w+)/g)];
  await page.goto(`/problems/${p!.id}`);
  await waitReady(page);

  // 머리의 첫 날짜를 하루 옮겨 실험해도 채점은 원본 머리로
  const [whole, ym, dd] = vars[0];
  const moved = whole.replace(`${ym}-${dd}`, `${ym}-${dd === "01" ? "02" : "01"}`);
  await setEditor(page, head.replace(whole, moved) + body);
  await page.getByRole("button", { name: /실행/ }).click();
  await expect(page.getByText("정답", { exact: true })).toBeVisible();
  await expect(page.getByText("채점은 문제의 변수 설정으로 다시 실행한 결과입니다.")).toBeVisible();

  // 본문의 p.변수 자리에 날짜를 직접 쓰면 변형(다른 기간)에서 틀린다
  let hard = body;
  for (const [, y, d, name] of vars) hard = hard.replaceAll(`p.${name}`, `DATE '${y}-${d}'`);
  test.skip(hard === body, "본문이 p.변수 형태로 변수를 읽지 않습니다");
  await setEditor(page, head + hard);
  await page.getByRole("button", { name: /실행/ }).click();
  await expect(page.getByText("오답", { exact: true })).toBeVisible();
  await expect(page.getByText(/ 기준$/).first()).toBeVisible();
});

test("객관식 문제 채점", async ({ page }) => {
  const p = problem("ba-04-date-between-boundary");
  await page.goto(`/problems/${p.id}`);
  for (const key of p.choices!.answer) await page.getByRole("button", { name: new RegExp(`^${key}\\b`) }).click();
  await page.getByRole("button", { name: "채점" }).click();
  await expect(page.getByText("정답", { exact: true })).toBeVisible();
});

test("모의 시험(잠긴 세트): 잠금 해제, 시작, 타이머, 문제 이동, 종료 요약", async ({ page }) => {
  const mock = set("archive-mock");
  const first = problem(mock.problems[0]);
  await unlock(page);
  await page.goto(`/mock/${mock.id}`);
  await page.getByRole("button", { name: "시작" }).click();
  await expect(page.getByText(new RegExp(`남은 시간 ${mock.timeLimitMin! - 1}:`))).toBeVisible();
  await waitReady(page);
  await expect(page.getByText("해설 먼저 보기")).toHaveCount(0);
  await setEditor(page, first.solutions!.postgres!);
  await page.getByRole("button", { name: /실행/ }).click();
  await expect(page.getByText("정답", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "다음 문제" }).click();
  await expect(page.getByText(`2 / ${mock.problems.length}`)).toBeVisible();
  await page.getByRole("button", { name: "시험 종료" }).click();
  await expect(page.getByRole("heading", { name: "결과" })).toBeVisible();
  await expect(page.getByText(new RegExp(`${mock.problems.length}문제 중 1문제 정답`))).toBeVisible();
});

test("출력 예측: 예상 결과 입력 채점과 실행 확인", async ({ page }) => {
  const p = problem("ba-09-predict-order-counts");
  await page.goto("/sets/basics-02-aggregate-group");
  await page.locator(`a[href="/problems/${p.id}"]`).click();
  await expect(page).toHaveURL(new RegExp(`/problems/${p.id}`));
  await expect(page.getByText("출력 예측").first()).toBeVisible();
  await expect(page.getByText(p.input!.title, { exact: true }).first()).toBeVisible();
  const box = page.getByRole("textbox", { name: "예상 결과" });
  await box.fill("1, 2, 3, 4, 5, 6, 7");
  await page.getByRole("button", { name: "채점" }).click();
  await expect(page.getByText("오답", { exact: true })).toBeVisible();
  await box.fill(p.expected!.rows.map((r) => r.join(", ")).join("\n"));
  await page.getByRole("button", { name: "채점" }).click();
  await expect(page.getByText("정답", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "해설" })).toBeVisible();
  await waitReady(page);
  await page.getByRole("button", { name: "실행해서 확인" }).click();
  await expect(page.getByRole("tab", { name: new RegExp(`PostgreSQL 실행 결과 ${p.expected!.rows.length}행`) })).toBeVisible();
});

test("결과 이상 찾기: 행 선택 채점", async ({ page }) => {
  const p = problem("ba-25-spot-fanout-shipping");
  await page.goto(`/problems/${p.id}`);
  await expect(page.getByText("결과 이상 찾기").first()).toBeVisible();
  const anomalies = p.spot!.anomalyRows;
  await page.getByRole("checkbox", { name: `${anomalies[0] + 1}번째 행 선택` }).check();
  await page.getByRole("button", { name: "채점" }).click();
  await expect(page.getByText("오답", { exact: true })).toBeVisible();
  for (const i of anomalies.slice(1)) await page.getByRole("checkbox", { name: `${i + 1}번째 행 선택` }).check();
  await page.getByRole("button", { name: "채점" }).click();
  await expect(page.getByText("정답", { exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: /올바른 결과/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("checkbox", { name: `${anomalies[0] + 1}번째 행 선택` })).toBeChecked();
});

const markLine = async (page: Page, line: number, category: ReviewCategory) => {
  await page.getByRole("button", { name: `${line}번째 줄`, exact: true }).click();
  await page.getByRole("radiogroup", { name: `${line}번째 줄 결함 유형` }).getByRole("radio", { name: REVIEW_CATEGORY[category].label }).click();
};
const firstLine = (ref: { lines: Partial<Record<string, number[]>> }, dialect = "postgres") => ref.lines[dialect]![0];
const banner = (page: Page) => page.getByText(/결함 \d+개 중 \d+개 찾음/);

test("쿼리 리뷰: 유형 다름·오탐 채점, 정답 공개, 새로고침 유지, 검증 쿼리", async ({ page }) => {
  const reviewSet = set("review-marketing");
  const p: Problem = problem(reviewSet.problems[1]);
  const review = p.review!;
  const [d0, ...rest] = review.defects;
  const decoy = review.decoys[0];
  const other: ReviewCategory = d0.category === "duplicate" ? "fanout" : "duplicate";

  await page.goto("/practice");
  await expect(page.getByRole("button", { name: /^쿼리 리뷰/ })).toBeVisible();
  await page.goto(`/sets/${reviewSet.id}`);
  await page.getByRole("link", { name: new RegExp(p.title) }).click();
  await expect(page).toHaveURL(new RegExp(`/problems/${p.id}`));
  await expect(page.getByText("리뷰 체크리스트")).toBeVisible();
  await expect(page.getByRole("tab", { name: `검토 쿼리 결과 ${review.results.postgres!.rows.length}행` })).toBeVisible();

  // 결함 줄에 다른 유형: 유형 다름
  await markLine(page, firstLine(d0), other);
  await page.getByRole("button", { name: "채점" }).click();
  await expect(page.getByText("오답", { exact: true })).toBeVisible();
  await expect(banner(page)).toHaveText(`결함 ${review.defects.length}개 중 0개 찾음 · 유형 다름 1줄`);
  await expect(page.getByRole("button", { name: `${firstLine(d0)}번째 줄`, exact: true })).toContainText("유형 다름");

  // 맞는 줄 표시: 결함 아님, 정답은 아직 숨김
  await markLine(page, firstLine(decoy), "join");
  await page.getByRole("button", { name: "채점" }).click();
  await expect(banner(page)).toHaveText(`결함 ${review.defects.length}개 중 0개 찾음 · 유형 다름 1줄 · 결함 아님 1줄`);
  await expect(page.getByRole("button", { name: `${firstLine(decoy)}번째 줄`, exact: true })).toContainText("결함 아님");
  await expect(page.getByRole("button", { name: "정답 보기" })).toBeVisible();
  await expect(page.getByText(d0.title)).toHaveCount(0);

  // 고쳐서 통과하면 결함 설명·올바른 결과가 열린다
  await markLine(page, firstLine(d0), d0.category);
  await page.getByRole("button", { name: `${firstLine(decoy)}번째 줄`, exact: true }).click();
  await page.getByRole("button", { name: "표시 지우기" }).click();
  for (const d of rest) await markLine(page, firstLine(d), d.category);
  await page.getByRole("button", { name: "채점" }).click();
  await expect(page.getByText("정답", { exact: true })).toBeVisible();
  await expect(banner(page)).toHaveText(`결함 ${review.defects.length}개 중 ${review.defects.length}개 찾음`);
  for (const d of review.defects) await expect(page.getByText(d.title)).toBeVisible();
  await expect(page.getByRole("tab", { name: `올바른 결과 ${p.expected!.rows.length}행` })).toBeVisible();
  await page.getByRole("tab", { name: /^맞는 줄/ }).click();
  await expect(page.getByText(decoy.explanation)).toBeVisible();

  // 새로고침 후 표시 유지
  await page.reload();
  await expect(page.getByRole("button", { name: `${firstLine(d0)}번째 줄`, exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: `${firstLine(decoy)}번째 줄`, exact: true })).toHaveAttribute("aria-pressed", "false");

  // 검증 쿼리는 채점 없이 실행된다
  await waitReady(page);
  await page.getByRole("tab", { name: "검증 쿼리" }).click();
  await setEditor(page, "SELECT COUNT(*) AS n FROM users WHERE signed_up_at >= '2025-05-31' AND signed_up_at < '2025-06-01'");
  await page.getByRole("button", { name: /^실행/ }).click();
  await expect(page.getByRole("table", { name: "검증 쿼리 결과" })).toContainText("2");
});

test("쿼리 리뷰: 방언에 따라 결함 수가 달라진다(정수 나눗셈)", async ({ page }) => {
  const p = problem(set("review-marketing").problems[0]);
  const review = p.review!;
  const common = review.defects.filter((d) => !d.dialects);
  const pgOnly = review.defects.filter((d) => d.dialects?.includes("postgres") && d.dialects.length === 1);
  expect(pgOnly.length).toBeGreaterThan(0);
  await page.goto(`/problems/${p.id}`);
  for (const d of common) await markLine(page, firstLine(d), d.category);
  await page.getByRole("button", { name: "채점" }).click();
  await expect(banner(page)).toHaveText(`결함 ${review.defects.length}개 중 ${common.length}개 찾음`);
  await page.getByRole("radio", { name: "BigQuery" }).click();
  for (const d of common) await markLine(page, firstLine(d, "bigquery"), d.category);
  await page.getByRole("button", { name: "채점" }).click();
  await expect(page.getByText("정답", { exact: true })).toBeVisible();
  await expect(banner(page)).toHaveText(`결함 ${common.length}개 중 ${common.length}개 찾음`);
});

test("공고 분석: 역량 태그와 추천 문제, 잠긴 문제 제외, 새로고침 후 유지", async ({ page }) => {
  const locked = lockedSchemaIds();
  const lockedTitles = problems()
    .filter((p) => locked.has(p.schema))
    .map((p) => p.title);
  await page.goto("/jd");
  const box = page.getByRole("textbox", { name: "채용 공고" });
  await expect(page.getByRole("button", { name: "분석" })).toBeDisabled();
  await box.fill("앱 이벤트 로그로 퍼널 전환율을 분석하고 A/B 테스트로 검증합니다. 데이터 정합성을 검증합니다. 결제·정산 데이터를 다룹니다.");
  await page.getByRole("button", { name: "분석" }).click();
  const skills = page.getByRole("list").filter({ hasText: "퍼널 분석" }).first();
  await expect(skills.getByText("퍼널 분석")).toBeVisible();
  await expect(skills.getByText("A/B 테스트와 실험")).toBeVisible();
  await expect(skills.getByText("정합성과 데이터 품질 검증")).toBeVisible();
  const funnel = page.locator('a[href^="/problems/"]').filter({ hasText: "퍼널 분석" }).first();
  await expect(funnel).toBeVisible();
  const recommended = await page.locator('a[href^="/problems/"]').allTextContents();
  expect(recommended.length).toBeGreaterThan(0);
  for (const t of lockedTitles) expect(recommended.some((r) => r.includes(t)), `잠긴 문제가 추천에 보임: ${t}`).toBe(false);
  await page.reload();
  await expect(page.getByText(/퍼널 전환율을 분석하고/)).toBeVisible();
  await expect(funnel).toBeVisible();
  await page.getByRole("button", { name: "수정" }).click();
  await expect(box).toHaveValue(/퍼널 전환율/);
  await box.fill("점심 메뉴를 알려주세요.");
  await page.getByRole("button", { name: "분석" }).click();
  await expect(page.getByText("SQL 역량 키워드를 찾지 못했습니다")).toBeVisible();
  await expect(page.getByRole("heading", { name: "추천 문제" })).toHaveCount(0);
  await page.getByRole("button", { name: "수정" }).click();
  await box.fill("퍼널 전환율 분석");
  await page.getByRole("button", { name: "분석" }).click();
  const target = page.locator('a[href^="/problems/"]').filter({ hasText: "퍼널 분석" }).first();
  const href = await target.getAttribute("href");
  await target.click();
  await expect(page).toHaveURL(new RegExp(`${href}$`));
});

test("공고 추천 모의 시험: 추천 앞 6문제·최대 60분으로 바로 시작, 다른 스키마 문제 채점, 종료 요약, 새로고침 후 유지", async ({ page }) => {
  await page.goto("/jd");
  await page.getByRole("textbox", { name: "채용 공고" }).fill("앱 이벤트 로그로 퍼널 전환율을 분석하고 A/B 테스트로 검증합니다. 데이터 정합성을 검증합니다. 결제·정산 데이터를 다룹니다.");
  await page.getByRole("button", { name: "분석" }).click();
  const links = page.locator('a[href^="/problems/"]');
  await expect(links.first()).toBeVisible();
  const recs = (await links.evaluateAll((els) => els.map((e) => e.getAttribute("href")!.replace("/problems/", "")))).map(problem);
  expect(recs.length, "추천이 6문제를 넘어야 앞 6문제만 담는지 확인할 수 있음").toBeGreaterThan(6);
  const exam = recs.slice(0, 6);
  const n = exam.length;
  const minutes = Math.min(60, exam.reduce((a, p) => a + (p.timeLimitMin ?? 10), 0));
  const target = exam.findIndex((p) => (p.format === "write" || p.format === "fix") && p.schema !== exam[0].schema && p.solutions?.postgres);
  expect(target, "첫 문제와 스키마가 다른 쿼리 문제가 추천에 없음").toBeGreaterThan(0);

  await page.getByRole("button", { name: "모의 시험 시작" }).click();
  await expect(page).toHaveURL(/\/mock\/jd$/);
  await expect(page.getByRole("heading", { name: "공고 추천 모의 시험" })).toBeVisible();
  await expect(page.getByText(new RegExp(`^문제 ${n}개, 제한 시간 ${minutes}분`))).toBeVisible();
  const items = page.locator("main ol > li").filter({ visible: true });
  await expect(items).toHaveCount(n);
  for (const [i, p] of exam.entries()) await expect(items.nth(i)).toContainText(p.title);

  await page.getByRole("button", { name: "시작", exact: true }).click();
  await expect(page.getByText(new RegExp(`남은 시간 ${String(minutes - 1).padStart(2, "0")}:`))).toBeVisible();
  await page.getByRole("button", { name: String(target + 1), exact: true }).click();
  await expect(page.getByText(`${target + 1} / ${n}`)).toBeVisible();
  await waitReady(page);
  await expect(page.getByText("해설 먼저 보기")).toHaveCount(0);
  await setEditor(page, exam[target].solutions!.postgres!);
  await page.getByRole("button", { name: /실행/ }).click();
  await expect(page.getByText("정답", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "시험 종료" }).click();
  await expect(page.getByRole("heading", { name: "결과" })).toBeVisible();
  await expect(page.getByText(new RegExp(`${n}문제 중 1문제 정답`))).toBeVisible();
  await expect(page.getByRole("link", { name: "문제 목록으로" })).toHaveAttribute("href", "/jd");

  await page.reload();
  await expect(page.getByText(new RegExp(`^문제 ${n}개, 제한 시간 ${minutes}분`))).toBeVisible();
});

test("공고 추천 모의 시험: 잠긴 문제는 저장값에 넣어도·잠금을 풀어도 빠지고, 저장값이 많아도 6문제·60분까지, 저장값이 없으면 공고 분석으로 안내", async ({ page }) => {
  const locked = lockedSchemaIds();
  const lockedProblem = problems().find((p) => locked.has(p.schema))!;
  const openProblem = problems().find((p) => !locked.has(p.schema))!;
  await unlock(page);
  const res = await page.request.get(`/api/mock-set?ids=${lockedProblem.id},${openProblem.id}`);
  const body = (await res.json()) as { problems: { id: string }[]; schemas: { id: string }[] };
  expect(body.problems.map((p) => p.id)).toEqual([openProblem.id]);
  expect(body.schemas.map((s) => s.id)).toEqual([openProblem.schema]);

  await page.goto("/mock/jd");
  await expect(page.getByText("저장된 추천 문제가 없습니다.")).toBeVisible();
  await expect(page.getByRole("link", { name: "공고 분석으로" })).toHaveAttribute("href", "/jd");

  await page.evaluate(([key, value]) => window.localStorage.setItem(key, value), [JD_MOCK_SET_KEY, JSON.stringify({ problems: [lockedProblem.id, openProblem.id], competencies: [] })]);
  await page.reload();
  await expect(page.getByText(/^문제 1개,/)).toBeVisible();
  await expect(page.locator("main ol > li").filter({ visible: true })).toHaveCount(1);
  await expect(page.getByText(openProblem.title)).toBeVisible();
  await expect(page.getByText(lockedProblem.title)).toHaveCount(0);

  const long = problems()
    .filter((p) => !locked.has(p.schema))
    .sort((a, b) => (b.timeLimitMin ?? 10) - (a.timeLimitMin ?? 10))
    .slice(0, 8);
  expect(long.slice(0, 6).reduce((a, p) => a + (p.timeLimitMin ?? 10), 0), "앞 6문제 권장 시간 합이 60분을 넘어야 상한을 확인할 수 있음").toBeGreaterThan(60);
  await page.evaluate(([key, value]) => window.localStorage.setItem(key, value), [JD_MOCK_SET_KEY, JSON.stringify({ problems: long.map((p) => p.id), competencies: [] })]);
  await page.reload();
  await expect(page.getByText(/^문제 6개, 제한 시간 60분/)).toBeVisible();
  const items = page.locator("main ol > li").filter({ visible: true });
  await expect(items).toHaveCount(6);
  for (const [i, p] of long.slice(0, 6).entries()) await expect(items.nth(i)).toContainText(p.title);
});
