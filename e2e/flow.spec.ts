import { expect, test, type Page } from "@playwright/test";
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
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("라이브 쿼리");
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

  // MySQL (원격 Route Handler)
  await page.getByRole("radio", { name: "MySQL" }).click();
  await waitReady(page);
  await setEditor(page, p.solutions!.mysql!);
  await page.getByRole("button", { name: /실행/ }).click();
  await expect(page.getByText("정답", { exact: true })).toBeVisible();
  await setEditor(page, "DROP TABLE orders");
  await page.getByRole("button", { name: /실행/ }).click();
  await expect(page.locator("pre", { hasText: /조회 쿼리만/ })).toBeVisible();

  // 새로고침 후 방언·쿼리·통과 상태 유지
  await page.reload();
  await expect(page.getByRole("radio", { name: "MySQL" })).toBeChecked();
  await expect(page.locator(".cm-content")).toContainText("DROP TABLE");
  await page.goto("/sets/basics-01-select-filter");
  const row = page.getByRole("link", { name: new RegExp(p.title) });
  await expect(row.getByText("통과")).toBeVisible();
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
  await expect(box).toHaveValue(/퍼널 전환율/);
  await expect(funnel).toBeVisible();
  await box.fill("점심 메뉴를 알려주세요.");
  await page.getByRole("button", { name: "분석" }).click();
  await expect(page.getByText("SQL 역량 키워드를 찾지 못했습니다")).toBeVisible();
  await expect(page.getByRole("heading", { name: "추천 문제" })).toHaveCount(0);
  await box.fill("퍼널 전환율 분석");
  await page.getByRole("button", { name: "분석" }).click();
  const target = page.locator('a[href^="/problems/"]').filter({ hasText: "퍼널 분석" }).first();
  const href = await target.getAttribute("href");
  await target.click();
  await expect(page).toHaveURL(new RegExp(`${href}$`));
});
