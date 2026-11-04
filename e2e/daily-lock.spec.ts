import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { devices, expect, test } from "@playwright/test";
import type { Card, SyntaxRef } from "../lib/content/types";
import { problem, set } from "./content";

const DIR = "content/cards";
const cards: Card[] = readdirSync(DIR).flatMap((f) => (JSON.parse(readFileSync(path.join(DIR, f), "utf-8")) as { cards: Card[] }).cards);
const byPrompt = new Map(cards.map((c) => [c.prompt, c]));
const syntaxTitle = new Map((JSON.parse(readFileSync("content/syntax/functions.json", "utf-8")) as SyntaxRef[]).map((s) => [s.id, s.title]));

test("홈: 분류 순서와 잠긴 세트 표시", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("section > h2")).toHaveText(["기초 문법", "직무별 실무", "KPI 대시보드", "비공개 복습 아카이브"]);
  await expect(page.getByLabel("잠김")).toHaveCount(3);
});

test("잠금: 비밀번호 전에는 문제가 보이지 않고, 틀린 비밀번호는 거절, 맞으면 세트와 문제가 열린다", async ({ page }) => {
  const archive = set("archive-practice");
  const first = problem(archive.problems[0]);
  const promptHead = first.prompt.slice(0, 12);
  await page.goto(`/sets/${archive.id}`);
  await expect(page.getByPlaceholder("비밀번호")).toBeVisible();
  await expect(page.locator('a[href^="/problems/"]')).toHaveCount(0);
  await page.goto(`/problems/${first.id}`);
  await expect(page.getByPlaceholder("비밀번호")).toBeVisible();
  await expect(page.getByText(promptHead)).toHaveCount(0);

  await page.getByPlaceholder("비밀번호").fill("0000");
  await page.getByRole("button", { name: "열기" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("비밀번호가 맞지 않습니다");

  await page.getByPlaceholder("비밀번호").fill(process.env.UNLOCK_PASSWORD ?? "");
  await page.getByRole("button", { name: "열기" }).click();
  await expect(page.getByText(promptHead).first()).toBeVisible();
  await page.goto(`/sets/${archive.id}`);
  await expect(page.locator('a[href^="/problems/"]')).toHaveCount(archive.problems.length);
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

    // 빈칸은 처음부터 정답 글자 수만큼 보이고, 정답보다 길게 쓰면 늘었다가 지우면 그 너비로 돌아온다
    const blank = page.getByLabel("빈칸");
    const widthOf = async () => (await blank.boundingBox())!.width;
    const { ch, pad } = await blank.evaluate((el) => {
      // 빈칸 옆(같은 코드 블록)에서 잰다. body 에 붙이면 모바일 글자 자동 확대로 폭이 달라진다
      const s = document.createElement("span");
      s.style.cssText = `position:absolute;visibility:hidden;font:${getComputedStyle(el).font}`;
      s.textContent = "0".repeat(20);
      el.parentElement!.append(s);
      const w = s.getBoundingClientRect().width / 20;
      s.remove();
      const cs = getComputedStyle(el);
      return { ch: w, pad: parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth) };
    });
    const answerLen = first!.answers[0].length;
    const empty = await widthOf();
    expect(Math.abs(empty - (answerLen * ch + pad)), "빈 상태 너비 = 정답 글자 수").toBeLessThan(1.5);
    await blank.fill("x".repeat(answerLen + 8));
    await expect.poll(widthOf).toBeGreaterThan(empty + 7 * ch);
    await blank.fill("x".repeat(Math.max(answerLen - 1, 0)));
    await expect.poll(widthOf).toBeCloseTo(empty, 0);

    // 1장: 오답
    await page.getByLabel("빈칸").fill("zzz_wrong");
    await page.getByRole("button", { name: "확인" }).click();
    await expect(page.getByText("오답", { exact: true })).toBeVisible();
    await expect(page.getByText("5분 뒤 복습")).toBeVisible();
    await expect(page.locator("article pre").first()).toContainText(first!.answers[0]);
    // 풀고 나면 이 카드의 함수 문법이 함께 보인다
    const grammar = page.getByRole("region", { name: "문법" });
    for (const id of first!.syntax) await expect(grammar).toContainText(syntaxTitle.get(id)!);
    await page.getByRole("button", { name: "다음 문제" }).click();
    const shown = [first!];

    // 2장: 힌트 후 정답, 3~5장: 정답 (Enter 제출)
    for (let i = 0; i < 4; i++) {
      const card = await promptOf();
      expect(card).toBeTruthy();
      shown.push(card!);
      await expect(page.locator("article").getByText("응용", { exact: true })).toHaveCount(card!.level === "applied" ? 1 : 0);
      if (i === 0) {
        await page.getByRole("button", { name: "힌트" }).click();
        await expect(page.getByText(card!.hint)).toBeVisible();
      }
      await page.getByLabel("빈칸").fill(card!.answers[0]);
      await page.getByLabel("빈칸").press("Enter");
      await expect(page.getByText(i === 0 ? "정답 (힌트 사용)" : "정답", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "다음 문제" }).click();
    }

    // 새 카드는 자주 쓰는 카드 위주: 5장 중 응용은 1장 이하
    expect(shown.filter((c) => c.level === "applied").length).toBeLessThanOrEqual(1);

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
