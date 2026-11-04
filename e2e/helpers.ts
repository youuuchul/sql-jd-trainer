import { expect, type Page } from "@playwright/test";

/** 잠긴 비공개 세트를 UI 로 연다. 비밀번호는 .env.local 의 UNLOCK_PASSWORD (playwright.config 가 읽는다) */
export const unlock = async (page: Page) => {
  const password = process.env.UNLOCK_PASSWORD;
  if (!password) throw new Error("UNLOCK_PASSWORD 환경변수가 필요합니다");
  await page.goto("/sets/archive-practice");
  await page.getByPlaceholder("비밀번호").fill(password);
  await page.getByRole("button", { name: "열기" }).click();
  await expect(page.locator('a[href^="/problems/"]').first()).toBeVisible();
};
