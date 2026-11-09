import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { devices, expect, test, type Page } from "@playwright/test";
import type { Card, SyntaxRef } from "../lib/content/types";
import { maskAnswers } from "../lib/daily/srs";
import { problem, set } from "./content";

const DIR = "content/cards";
const cards: Card[] = readdirSync(DIR).flatMap((f) => (JSON.parse(readFileSync(path.join(DIR, f), "utf-8")) as { cards: Card[] }).cards);
const DIALECT_TEXT = { common: "공통", postgres: "PostgreSQL", bigquery: "BigQuery", mysql: "MySQL" };
/** 같은 문장 카드가 방언·수준만 달라 둘 이상 있다. 화면 카드 윗줄의 방언 라벨과 응용 표시로 정확히 고른다 */
const shownCard = async (page: Page): Promise<Card> => {
  const prompt = ((await page.locator("article h2").first().textContent()) ?? "").trim();
  const row = await page.locator("article > div").first().innerText();
  const found = cards.filter((c) => c.prompt === prompt && row.includes(DIALECT_TEXT[c.dialect]) && row.includes("응용") === (c.level === "applied"));
  expect(found, "화면의 카드가 덱에 하나만 있어야 한다").toHaveLength(1);
  return found[0];
};
const storedCard = (page: Page, id: string) => page.evaluate((cardId) => (JSON.parse(localStorage.getItem("sjt:daily:v1") ?? "{}") as { cards?: Record<string, { box: number; lapses: number }> }).cards?.[cardId], id);
const slotCount = (page: Page) => page.locator("article [data-slot]").count();
const byId = (id: string) => cards.find((c) => c.id === id)!;
const syntaxSummary = new Map((JSON.parse(readFileSync("content/syntax/functions.json", "utf-8")) as SyntaxRef[]).map((s) => [s.id, s]));
/** 지정한 카드들이 가장 먼저 나오도록 복습 시각이 지난 상태로 저장한다(격리된 브라우저의 저장값만 만든다) */
const seedDue = (page: Page, ids: string[]) =>
  page.addInitScript((list) => {
    if (localStorage.getItem("sjt:daily:v1")) return;
    const cardsState = Object.fromEntries(list.map((id, i) => [id, { box: 1, due: i + 1, reps: 1, lapses: 0, lastAt: 0 }]));
    localStorage.setItem("sjt:daily:v1", JSON.stringify({ cards: cardsState, days: {}, settings: { goal: 5, dialect: "all" } }));
  }, ids);
/** 힌트 단계: 정답이 3글자 이상이면 앞글자 → 추가 힌트, 짧으면 바로 추가 힌트 */
const openHints = async (page: Page, card: Card) => {
  await page.getByRole("button", { name: "힌트" }).click();
  if (card.answers[0].length >= 3) {
    await expect(page.locator("article [data-first-letter]")).toHaveText(card.answers[0][0]);
    await expect(page.getByText(card.hint)).toHaveCount(0);
    await page.getByRole("button", { name: "추가 힌트" }).click();
  } else {
    await expect(page.locator("article [data-first-letter]")).toHaveCount(0);
  }
  await expect(page.getByText(card.hint)).toBeVisible();
};
const setGoal = async (page: Page, goal: string) => {
  await page.getByRole("button", { name: "설정" }).click();
  await page.getByRole("radio", { name: goal }).click();
  await page.getByRole("dialog").getByRole("button", { name: "닫기" }).click();
};
const syntaxTitle = new Map((JSON.parse(readFileSync("content/syntax/functions.json", "utf-8")) as SyntaxRef[]).map((s) => [s.id, s.title]));

test("연습: 분류 순서와 잠긴 세트 표시", async ({ page }) => {
  await page.goto("/practice");
  const cards = page.locator("button[aria-pressed] > b");
  await expect(cards).toHaveText(["기초 문법", "직무별 실무", "데이터 파이프라인", "쿼리 리뷰", "비공개"]);
  await expect(page.getByLabel("잠김")).toHaveCount(0);
  await cards.last().click();
  await expect(page.getByLabel("잠김")).toHaveCount(3);
  await expect(page.locator('a[href^="/sets/archive-"]')).toHaveCount(3);
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

  test("오답을 내도 카드가 끝나지 않고, 정답 보기로 끝낸 카드는 5분 뒤 복습으로 다시 나오며, 결과와 하루 진행이 새로고침 후에도 남는다", async ({ page }) => {
    await page.goto("/");
    // 개발 서버의 Next 표시기가 왼쪽 아래 버튼을 가린다
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    await setGoal(page, "5장");
    await page.getByRole("button", { name: "시작하기" }).click();

    const first = await shownCard(page);
    const article = page.locator("article");

    // 빈칸은 처음부터 정답 글자 수만큼 칸이 보이고, 정답보다 길게 쓰면 칸이 늘었다가 지우면 그 칸 수로 돌아온다
    const blank = page.getByLabel("빈칸");
    const answerLen = first.answers[0].length;
    await expect.poll(() => slotCount(page), "빈 상태 칸 수 = 정답 글자 수").toBe(answerLen);
    await blank.fill("x".repeat(answerLen + 8));
    await expect.poll(() => slotCount(page)).toBeGreaterThanOrEqual(answerLen + 8);
    await blank.fill("x".repeat(Math.max(answerLen - 1, 0)));
    await expect.poll(() => slotCount(page)).toBe(answerLen);
    await blank.fill("");

    // 1장: 오답을 내도 카드가 끝나지 않는다. 입력이 남고 결과 시트는 열리지 않으며, 고쳐서 다시 낼 수 있다
    await blank.fill("zzz_wrong");
    await page.getByRole("button", { name: "확인" }).click();
    await expect(article.getByRole("alert")).toContainText("오답");
    await expect(blank).toHaveValue("zzz_wrong");
    await expect(page.getByRole("button", { name: "계속" })).toHaveCount(0);
    // 정답과 1글자 다른 오답은 몇 글자 다른지 알려 준다
    await blank.fill(`${first.answers[0].slice(0, -1)}~`);
    await blank.press("Enter");
    await expect(article.getByRole("alert")).toContainText("정답과 1글자 달라요");
    await expect(page.getByRole("button", { name: "계속" })).toHaveCount(0);
    // 왼쪽 버튼은 힌트 → 힌트를 본 뒤에는 정답 보기
    await openHints(page, first);
    await page.getByRole("button", { name: "정답 보기" }).click();
    await expect(page.getByText("오답", { exact: true })).toBeVisible();
    await expect(page.getByText("5분 뒤 다시 나옵니다")).toBeVisible();
    await expect(article.getByText("5분 뒤 복습")).toBeVisible();
    await expect(article.locator('[data-blank="right"]')).toHaveText(first.answers[0].replace(/ /g, "\u00a0"));
    // 풀고 나면 이 카드의 함수 문법이 함께 보인다
    const grammar = page.getByRole("region", { name: "문법" });
    for (const id of first.syntax) await expect(grammar).toContainText(syntaxTitle.get(id)!);
    await expect(grammar).not.toContainText("MySQL");
    // 기록은 카드가 끝날 때: 틀린 카드는 처음 상자(5분)
    expect(await storedCard(page, first.id)).toMatchObject({ box: 0, lapses: 1 });
    await page.getByRole("button", { name: "계속" }).click();
    const shown = [first];

    // 2장: 힌트 후 정답, 3~5장: 정답 (Enter 제출)
    for (let i = 0; i < 4; i++) {
      const card = await shownCard(page);
      shown.push(card);
      await expect(page.locator("article").getByText("응용", { exact: true })).toHaveCount(card.level === "applied" ? 1 : 0);
      if (i === 0) {
        await openHints(page, card);
      }
      await page.getByLabel("빈칸").fill(card.answers[0]);
      await page.getByLabel("빈칸").press("Enter");
      await expect(page.getByText("정답", { exact: true })).toBeVisible();
      if (i === 0) await expect(page.getByText("힌트를 쓴 정답")).toBeVisible();
      await page.getByRole("button", { name: "계속" }).click();
    }

    // 새 카드는 자주 쓰는 카드 위주: 5장 중 응용은 1장 이하
    expect(shown.filter((c) => c.level === "applied").length).toBeLessThanOrEqual(1);

    // 6번째: 정답 보기로 넘긴 카드가 다시 나온다. 또 정답 보기로 넘기면 또 나온다(직접 맞힐 때까지)
    expect((await shownCard(page)).id).toBe(first.id);
    await expect(page.getByText("다시", { exact: true })).toBeVisible();
    await openHints(page, first);
    await page.getByRole("button", { name: "정답 보기" }).click();
    await expect(page.getByText("5분 뒤 다시 나옵니다")).toBeVisible();
    await page.getByRole("button", { name: "계속" }).click();
    // 7번째: 같은 카드를 직접 입력해 맞히면 세션이 끝난다. 반복에서 맞혀도 복습 일정은 처음 결과(5분 뒤) 그대로
    expect((await shownCard(page)).id).toBe(first.id);
    await page.getByLabel("빈칸").fill(first.answers[0]);
    await page.getByLabel("빈칸").press("Enter");
    await expect(page.getByText("정답", { exact: true })).toBeVisible();
    await expect(page.getByText("5분 뒤 복습").first()).toBeVisible();
    expect(await storedCard(page, first.id)).toMatchObject({ box: 0, lapses: 1, reps: 1 });
    await page.getByRole("button", { name: "결과 보기" }).click();

    // 목표를 채운 뒤 연속 일수 화면: 푼 카드 5(정답 3, 힌트 정답 1, 오답 1)
    await expect(page.getByText("일 연속")).toBeVisible();
    const summary = page.locator("dl").last();
    await expect(summary).toContainText(/푼 카드\s*5/);
    await expect(summary).toContainText(/정답\s*3/);
    await expect(summary).toContainText(/힌트 정답\s*1/);
    await expect(summary).toContainText(/오답\s*1/);
    await page.reload();
    await expect(page.getByRole("progressbar", { name: "오늘 푼 카드" })).toHaveAttribute("aria-valuenow", "100");
    await expect(page.getByRole("button", { name: "5장 더 풀기" })).toBeVisible();
  });

  test("힌트는 앞글자 → 추가 힌트(말 설명·함수 뜻) → 정답 보기 순이고, 정답이 짧으면 앞글자를 건너뛴다", async ({ page }) => {
    const short = byId("c-agg-count-star");
    const long = byId("c-agg-count-distinct");
    await seedDue(page, [short.id, long.id]);
    await page.goto("/");
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    await page.getByRole("button", { name: "시작하기" }).click();

    // 정답 '*' 은 앞글자가 곧 정답이라 바로 추가 힌트
    expect((await shownCard(page)).id).toBe(short.id);
    await openHints(page, short);
    await expect(page.getByRole("button", { name: "정답 보기" })).toBeVisible();
    await page.getByLabel("빈칸").fill(short.answers[0]);
    await page.getByLabel("빈칸").press("Enter");
    await expect(page.getByText("힌트를 쓴 정답")).toBeVisible();
    await page.getByRole("button", { name: "계속" }).click();

    // 정답 DISTINCT: 앞글자 D → 추가 힌트에 함수 뜻, 정답은 ___ 로 가려진다 → 정답 보기
    expect((await shownCard(page)).id).toBe(long.id);
    await expect(page.getByRole("button", { name: "정답 보기" })).toHaveCount(0);
    await openHints(page, long);
    const hintBox = page.locator("article").getByText(long.hint).locator("xpath=ancestor::div[1]");
    await expect(hintBox).toContainText("첫 글자");
    for (const id of long.syntax) await expect(hintBox).toContainText(maskAnswers(syntaxSummary.get(id)!.summary, long.answers));
    await expect(hintBox).not.toContainText(new RegExp(`\\b${long.answers[0]}\\b`, "i"));
    await expect(hintBox).toContainText("___");
    await page.getByRole("button", { name: "정답 보기" }).click();
    await expect(page.getByText("오답", { exact: true })).toBeVisible();
  });

  test("오답을 낸 카드에서 그만하면 틀린 카드로 기록하고, 오답 없이 그만하면 기록하지 않는다", async ({ page }) => {
    const [a, b] = [byId("c-agg-count-star"), byId("c-agg-count-distinct")];
    await seedDue(page, [a.id, b.id]);
    await page.goto("/");
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    await page.getByRole("button", { name: "시작하기" }).click();
    await expect(page.getByLabel("빈칸")).toBeVisible();
    // 오답 없이 나가기: 기록 없음(시드 상태 그대로)
    await page.getByRole("button", { name: "그만하기" }).click();
    expect(await storedCard(page, a.id)).toMatchObject({ box: 1, lapses: 0 });
    // 오답을 낸 뒤 나가기: wrong(상자 0, lapses 1)
    await page.getByRole("button", { name: "이어서 풀기" }).or(page.getByRole("button", { name: "시작하기" })).click();
    await page.getByLabel("빈칸").fill("zzz_wrong");
    await page.getByLabel("빈칸").press("Enter");
    await expect(page.locator("article").getByRole("alert")).toBeVisible();
    await page.getByRole("button", { name: "그만하기" }).click();
    expect(await storedCard(page, a.id)).toMatchObject({ box: 0, lapses: 1 });
  });

  test("오답을 낸 뒤 맞혀도 기록은 틀린 카드(5분 뒤 복습)이고, 하루 풀이 수에는 한 장으로 센다", async ({ page }) => {
    await page.goto("/");
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    await page.getByRole("button", { name: "시작하기" }).click();
    const card = await shownCard(page);
    await page.getByLabel("빈칸").fill("zzz_wrong");
    await page.getByLabel("빈칸").press("Enter");
    await expect(page.locator("article").getByRole("alert")).toBeVisible();
    await page.getByLabel("빈칸").fill(card.answers[0]);
    await page.getByLabel("빈칸").press("Enter");
    await expect(page.getByText("정답", { exact: true })).toBeVisible();
    await expect(page.getByText("처음 단계로 돌아갑니다")).toBeVisible();
    await expect(page.locator("article").getByText("5분 뒤 복습")).toBeVisible();
    expect(await storedCard(page, card.id)).toMatchObject({ box: 0, lapses: 1 });
    const answered = await page.evaluate(() => Object.values((JSON.parse(localStorage.getItem("sjt:daily:v1") ?? "{}") as { days: Record<string, { answered: number }> }).days)[0].answered);
    expect(answered).toBe(1);
  });
});
