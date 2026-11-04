import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import type { Problem } from "../lib/content/types";

/** 잠기지 않은 스키마마다 첫 쿼리 작성 문제를 골라 브라우저 엔진 세 방언에서 정답 처리되는지 본다 */
const ROOT = "content/problems";
const problems: Problem[] = readdirSync(ROOT).flatMap((dir) =>
  readdirSync(path.join(ROOT, dir)).map((f) => JSON.parse(readFileSync(path.join(ROOT, dir, f), "utf-8")) as Problem),
);
const lockedSchemas = new Set(
  readdirSync("content/schemas")
    .map((f) => JSON.parse(readFileSync(path.join("content/schemas", f), "utf-8")) as { id: string; locked?: boolean })
    .filter((s) => s.locked)
    .map((s) => s.id),
);
const samples = [...new Set(problems.map((p) => p.schema))]
  .filter((s) => !lockedSchemas.has(s))
  .sort()
  .map((s) => problems.filter((p) => p.schema === s && p.format === "write").sort((a, b) => a.id.localeCompare(b.id))[0]);

const setEditor = async (page: Page, sql: string) => {
  await page.locator(".cm-content").click();
  await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await page.keyboard.press("Backspace");
  await page.keyboard.insertText(sql);
};

for (const p of samples) {
  test(`${p.schema}: ${p.id} 세 방언 정답`, async ({ page }) => {
    await page.goto(`/problems/${p.id}`);
    for (const [label, dialect] of [["PostgreSQL", "postgres"], ["BigQuery", "bigquery"], ["MySQL", "mysql"]] as const) {
      await page.getByRole("radio", { name: label }).click();
      await expect(page.getByText("준비됨")).toBeVisible({ timeout: 90_000 });
      await setEditor(page, p.solutions![dialect]!);
      await page.getByRole("button", { name: /실행/ }).click();
      await expect(page.getByText("정답", { exact: true }), `${dialect}`).toBeVisible();
    }
  });
}
