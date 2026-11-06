import { problem } from "./content";
import { unlock } from "./helpers";
import { expect, test, type Page } from "@playwright/test";

/** 배포 URL 대상 스모크. MySQL 서버 경로는 환경변수가 없으면 미연결 안내를 준다. E2E_BASE_URL 로 대상 지정. */
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

  // MySQL 은 화면에서 숨겼다. 서버 경로는 연결되면 ok, 아니면 미연결 안내를 준다
  await expect(page.getByRole("radio", { name: "MySQL" })).toHaveCount(0);
  const res = await page.request.get("/api/engine/mysql");
  const body = (await res.json()) as { ok: boolean; error?: string };
  expect(body.ok || /연결/.test(body.error ?? "")).toBe(true);
});
