import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { devices, expect, test } from "@playwright/test";
import type { Card } from "../lib/content/types";

const DIR = "content/cards";
const cards: Card[] = readdirSync(DIR).flatMap((f) => (JSON.parse(readFileSync(path.join(DIR, f), "utf-8")) as { cards: Card[] }).cards);
const byPrompt = new Map(cards.map((c) => [c.prompt, c]));

test("홈: 분류 순서와 잠긴 비공개 세트 표시", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("section > h2")).toHaveText(["기초 문법", "직무별 실무", "KPI 대시보드", "비공개 복습 아카이브"]);
  await expect(page.getByLabel("잠김")).toHaveCount(3);
});

test("잠금: 비밀번호 전에는 문제가 보이지 않고, 틀린 비밀번호는 거절, 맞으면 세트와 문제가 열린다", async ({ page }) => {
  await page.goto("/sets/archive-practice");
  await expect(page.getByPlaceholder("비밀번호")).toBeVisible();
  await expect(page.locator('a[href^="/problems/"]')).toHaveCount(0);
  await page.goto("/problems/e01-conversion-days");
  await expect(page.getByPlaceholder("비밀번호")).toBeVisible();
  await expect(page.getByText("(비공개)")).toHaveCount(0);

  await page.getByPlaceholder("비밀번호").fill("0000");
  await page.getByRole("button", { name: "열기" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("비밀번호가 맞지 않습니다");

  await page.getByPlaceholder("비밀번호").fill(process.env.UNLOCK_PASSWORD ?? "");
  await page.getByRole("button", { name: "열기" }).click();
  await expect(page.getByText("(비공개)").first()).toBeVisible();
  await page.goto("/sets/archive-practice");
  await expect(page.locator('a[href^="/problems/"]')).toHaveCount(20);
});

test.describe("하루 카드 (모바일)", () => {
  const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices["iPhone 13"];
  test.use({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });

  test("오답은 5분 뒤 복습으로 다시 나오고, 결과와 하루 진행이 새로고침 후에도 남는다", async ({ page }) => {
    await page.goto("/daily");
    // 개발 서버의 Next 표시기가 왼쪽 아래 버튼을 가린다
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    await page.getByRole("radio", { name: "5장" }).click();
    await page.getByRole("button", { name: "시작하기" }).click();

    const promptOf = async () => byPrompt.get(((await page.locator("article p").first().textContent()) ?? "").trim());
    const first = await promptOf();
    expect(first, "화면의 카드가 덱에 있어야 한다").toBeTruthy();

    // 빈칸 너비가 입력 길이에 맞춰 늘고 준다
    const blank = page.getByLabel("빈칸");
    const widthOf = async () => (await blank.boundingBox())!.width;
    const empty = await widthOf();
    await blank.fill("abcdefghijkl");
    await expect.poll(widthOf).toBeGreaterThan(empty * 2);
    await blank.fill("ab");
    await expect.poll(widthOf).toBeCloseTo(empty, 0);

    // 1장: 오답
    await page.getByLabel("빈칸").fill("zzz_wrong");
    await page.getByRole("button", { name: "확인" }).click();
    await expect(page.getByText("오답", { exact: true })).toBeVisible();
    await expect(page.getByText("5분 뒤 복습")).toBeVisible();
    await expect(page.locator("article pre")).toContainText(first!.answers[0]);
    await page.getByRole("button", { name: "다음 문제" }).click();

    // 2장: 힌트 후 정답, 3~5장: 정답 (Enter 제출)
    for (let i = 0; i < 4; i++) {
      const card = await promptOf();
      expect(card).toBeTruthy();
      if (i === 0) {
        await page.getByRole("button", { name: "힌트" }).click();
        await expect(page.getByText(card!.hint)).toBeVisible();
      }
      await page.getByLabel("빈칸").fill(card!.answers[0]);
      await page.getByLabel("빈칸").press("Enter");
      await expect(page.getByText(i === 0 ? "정답 (힌트 사용)" : "정답", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "다음 문제" }).click();
    }

    // 6번째: 틀렸던 카드가 다시 나온다
    expect((await promptOf())?.id).toBe(first!.id);
    await expect(page.getByText("다시", { exact: true })).toBeVisible();
    await page.getByLabel("빈칸").fill(first!.answers[0]);
    await page.getByLabel("빈칸").press("Enter");
    await page.getByRole("button", { name: "결과 보기" }).click();

    await expect(page.getByText("이번 학습")).toBeVisible();
    await expect(page.locator("section").first()).toContainText(/4\s*\/\s*5 정답/);
    await page.reload();
    await expect(page.locator("section").first()).toContainText(/5\s*\/\s*5/);
    await expect(page.getByRole("button", { name: "5장 더 풀기" })).toBeVisible();
  });
});
