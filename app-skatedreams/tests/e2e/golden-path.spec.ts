import { test, expect } from "@playwright/test";

test("login → ver agenda → abrir página de relatórios", async ({ page }) => {
  await page.goto("/login");
  await page.fill('input[name="email"]', process.env.SEED_EMAIL ?? "admin@skatedreams.local");
  await page.fill('input[name="password"]', process.env.SEED_PASSWORD ?? "trocar-em-producao");
  await page.click('button:has-text("Entrar")');

  await page.waitForURL("**/agenda");
  await expect(page.locator(".fc")).toBeVisible(); // FullCalendar root

  await page.goto("/relatorios");
  await expect(page.getByRole("heading", { name: "Relatórios" })).toBeVisible();
});
