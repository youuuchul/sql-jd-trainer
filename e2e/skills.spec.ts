import { expect, test, type Page } from "@playwright/test";
import { splitBlanks } from "../lib/grading/blanks";
import { problem, problems, set } from "./content";

const SKILL = "b-null";
const DAY = 86400000;
const first = problems()
  .filter((p) => p.skills?.[0] === SKILL && p.format === "write" && p.difficulty === "basic")
  .sort((a, b) => a.id.localeCompare(b.id))[0];

const setEditor = async (page: Page, sql: string) => {
  await page.locator(".cm-content").click();
  await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await page.keyboard.press("Backspace");
  await page.keyboard.insertText(sql);
};
const skillState = (page: Page, id: string) => page.evaluate((k) => (JSON.parse(localStorage.getItem("sjt:skills:v1") ?? "{}") as Record<string, { box: number; due: number }>)[k], id);

test("탭: 오늘·코스·유형·공고, 오늘에는 문제 경로가 없고 다음 문제 한 줄만 있다", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "주 메뉴" }).filter({ visible: true });
  await expect(nav.getByRole("link")).toHaveText(["오늘", "코스", "유형", "공고"]);
  await expect(page.getByRole("heading", { name: "다음 문제" })).toBeVisible();
  await expect(page.getByRole("main").locator('a[href^="/problems/"]')).toHaveCount(1);
  await nav.getByRole("link", { name: "유형" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("유형");
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(["패턴", "함수", "기초 문법"]);
});

test("유형: 유형에서 문제를 풀면 머리에 유형 이름이 나오고, 통과하면 다음 복습 날짜가 잡힌다", async ({ page }) => {
  await page.goto(`/skills/${SKILL}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("NULL 처리");
  await expect(page.getByRole("heading", { name: /입문/ })).toBeVisible();
  await page.getByRole("link", { name: "시작하기" }).click();
  await expect(page).toHaveURL(new RegExp(`/problems/${first.id}\\?skill=${SKILL}`));
  await expect(page.getByRole("link", { name: "유형으로 돌아가기" })).toHaveAttribute("href", `/skills/${SKILL}`);
  await expect(page.getByText("준비됨")).toBeVisible({ timeout: 90_000 });

  await setEditor(page, "SELECT 1 AS x");
  await page.getByRole("button", { name: /실행/ }).click();
  await expect(page.getByText("오답", { exact: true })).toBeVisible();
  expect(await skillState(page, SKILL)).toBeUndefined();

  await setEditor(page, first.solutions!.postgres!);
  await page.getByRole("button", { name: /실행/ }).click();
  await expect(page.getByText("정답", { exact: true })).toBeVisible();
  const state = await skillState(page, SKILL);
  expect(state.box).toBe(0);
  expect(state.due - Date.now()).toBeGreaterThan(DAY - 60_000);

  // 복습 시각 전에 다시 통과해도 간격은 그대로다
  await page.getByRole("button", { name: /실행/ }).click();
  await expect(page.getByText("정답", { exact: true })).toBeVisible();
  expect((await skillState(page, SKILL)).box).toBe(0);

  await page.goto(`/skills/${SKILL}`);
  await expect(page.getByText(/다음 복습/)).toBeVisible();
  await expect(page.getByRole("link", { name: new RegExp(first.title) })).toContainText("통과");
});

test("오늘: 복습 시각이 지난 유형이 문제 복습에 올라오고, 틀렸다가 통과하면 처음 간격으로 돌아간다", async ({ page }) => {
  await page.addInitScript((id) => {
    if (!localStorage.getItem("sjt:skills:v1")) localStorage.setItem("sjt:skills:v1", JSON.stringify({ [id]: { box: 2, due: 1, lastAt: 0 } }));
  }, SKILL);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "문제 복습" })).toBeVisible();
  const row = page.getByRole("region", { name: "문제 복습" }).getByRole("link");
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("NULL 처리");
  await expect(row).toHaveAttribute("href", `/problems/${first.id}?skill=${SKILL}`);
  await row.click();
  await expect(page.getByText("준비됨")).toBeVisible({ timeout: 90_000 });
  await setEditor(page, "SELECT 1 AS x");
  await page.getByRole("button", { name: /실행/ }).click();
  await expect(page.getByText("오답", { exact: true })).toBeVisible();
  expect((await skillState(page, SKILL)).box).toBe(-1);
  await setEditor(page, first.solutions!.postgres!);
  await page.getByRole("button", { name: /실행/ }).click();
  await expect(page.getByText("정답", { exact: true })).toBeVisible();
  expect((await skillState(page, SKILL)).box).toBe(0);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "문제 복습" })).toHaveCount(0);
});

test("코스: 풀다 만 문제가 맨 위에 올라온다", async ({ page }) => {
  const p = problem("ba-01-where-in-compare");
  await page.addInitScript((id) => {
    if (!localStorage.getItem("sjt:progress:v1")) localStorage.setItem("sjt:progress:v1", JSON.stringify({ [id]: { passed: false, attempts: 2, sql: {} } }));
  }, p.id);
  await page.goto("/practice");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("코스");
  const resume = page.getByRole("region", { name: "풀던 문제" }).getByRole("link");
  await expect(resume).toHaveCount(1);
  await expect(resume).toContainText(p.title);
  await expect(resume).toContainText("미통과");
});

test("빈칸 채우기: 가린 자리를 채워 실행하면 결과로 채점하고, 작성하던 쿼리는 바꾸지 않는다", async ({ page }) => {
  const p = problem("b0-07-where-compare-rating");
  await page.goto(`/problems/${p.id}?mode=blank`);
  await expect(page.getByText("준비됨")).toBeVisible({ timeout: 90_000 });
  const blanks = page.getByRole("textbox", { name: /^빈칸 \d+$/ });
  const { answers } = splitBlanks(p.solutions!.postgres!, p.blanks!.postgres!)!;
  const cond = answers.indexOf("<= 2");
  expect(cond).toBeGreaterThan(-1);
  await expect(blanks).toHaveCount(answers.length);
  await expect(page.getByRole("button", { name: /실행/ })).toBeDisabled();
  for (const [i, a] of answers.entries()) await blanks.nth(i).fill(i === cond ? "< 2" : a);
  await page.getByRole("button", { name: /실행/ }).click();
  await expect(page.getByText("오답", { exact: true })).toBeVisible();
  // 정답과 글자가 달라도 결과가 같으면 통과
  await blanks.nth(cond).fill("< 3");
  await page.getByRole("button", { name: /실행/ }).click();
  await expect(page.getByText("정답", { exact: true })).toBeVisible();
  expect(await page.evaluate((id) => (JSON.parse(localStorage.getItem("sjt:progress:v1") ?? "{}") as Record<string, { sql: Record<string, string> }>)[id]?.sql.postgres, p.id)).toBeUndefined();
  await page.getByRole("button", { name: "직접 작성" }).click();
  await expect(page.locator(".cm-content")).toBeVisible();
  await expect(blanks).toHaveCount(0);
});

test("숙박 예약 모의 시험: 60분 타이머로 시작해 첫 문제를 채점하고 종료 요약을 본다", async ({ page }) => {
  const mock = set("jobs-stay-mock");
  const firstMock = problem(mock.problems[0]);
  await page.goto(`/mock/${mock.id}`);
  await page.getByRole("button", { name: "시작" }).click();
  await expect(page.getByText(/남은 시간 59:/)).toBeVisible();
  await expect(page.getByText("준비됨")).toBeVisible({ timeout: 90_000 });
  await setEditor(page, firstMock.solutions!.postgres!);
  await page.getByRole("button", { name: /실행/ }).click();
  await expect(page.getByText("정답", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "다음 문제" }).click();
  await expect(page.getByText(`2 / ${mock.problems.length}`)).toBeVisible();
  await page.getByRole("button", { name: "시험 종료" }).click();
  await expect(page.getByText(new RegExp(`${mock.problems.length}문제 중 1문제 정답`))).toBeVisible();
});

test("MySQL: 화면에서 MySQL 을 골라 숙박 예약 문제를 채점한다", async ({ page }) => {
  test.skip(process.env.NEXT_PUBLIC_MYSQL !== "1", "NEXT_PUBLIC_MYSQL=1 로 띄운 서버에서만");
  const p = problem("st-d3-first-booking-within-7d");
  await page.goto(`/problems/${p.id}`);
  await page.getByRole("radio", { name: "MySQL" }).click();
  await expect(page.getByText("준비됨")).toBeVisible({ timeout: 90_000 });
  await setEditor(page, p.solutions!.mysql!);
  await page.getByRole("button", { name: /실행/ }).click();
  await expect(page.getByText("정답", { exact: true })).toBeVisible();
  await page.goto(`/problems/${p.id}?mode=blank`);
  await expect(page.getByRole("radio", { name: "MySQL" })).toBeChecked();
  const blanks = page.getByRole("textbox", { name: /^빈칸 \d+$/ });
  await expect(blanks).toHaveCount(p.blanks!.mysql!.length);
});
