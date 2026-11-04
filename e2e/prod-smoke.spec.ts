import { problem } from "./content";
import { unlock } from "./helpers";
import { expect, test, type Page } from "@playwright/test";

/** 배포 URL 대상 스모크. MySQL은 서버 환경변수가 없으면 연결 실패 안내가 떠야 한다. E2E_BASE_URL 로 대상 지정. */
const p = problem("ba-01-where-in-compare");

const setEditor = async (page: Page, sql: string) => {
  await page.locator(".cm-content").click();
  await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await page.keyboard.press("Backspace");
  await page.keyboard.insertText(sql);
};

test("배포 스모크: PostgreSQL·BigQuery 실행, MySQL 미연결 안내", async ({ page }) => {
  test.skip(!process.env.E2E_BASE_URL, "E2E_BASE_URL 필요");
  await unlock(page);
  await page.goto(`/problems/${p.id}`);
  await expect(page.getByText("준비됨")).toBeVisible({ timeout: 90_000 });
  await setEditor(page, p.solutions!.postgres!);
  await page.getByRole("button", { name: /실행/ }).click();
  await expect(page.getByText("정답", { exact: true })).toBeVisible();

  await page.getByRole("radio", { name: "BigQuery" }).click();
  await expect(page.getByText("준비됨")).toBeVisible({ timeout: 90_000 });
  await setEditor(page, p.solutions!.bigquery!);
  await page.getByRole("button", { name: /실행/ }).click();
  await expect(page.getByText("정답", { exact: true })).toBeVisible();

  await page.getByRole("radio", { name: "MySQL" }).click();
  await expect(page.getByText(/연결 실패|준비됨/)).toBeVisible({ timeout: 30_000 });
});
