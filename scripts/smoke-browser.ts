/**
 * Smoke browser para reproduzir erros de runtime visíveis ao usuário.
 * Uso: PLAYWRIGHT_BASE=http://localhost:3001 npx tsx scripts/smoke-browser.ts
 */
import { chromium } from "playwright";

const BASE = process.env.PLAYWRIGHT_BASE ?? "http://localhost:3001";
const SEED_EMAIL = process.env.SEED_EMAIL ?? "admin@skatedreams.local";
const SEED_PASSWORD = process.env.SEED_PASSWORD ?? "trocar-em-producao";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`);
  });

  console.log("== Login ==");
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', SEED_EMAIL);
  await page.fill('input[name="password"]', SEED_PASSWORD);
  await page.click('button:has-text("Entrar")');
  await page.waitForURL("**/agenda", { timeout: 10_000 });
  console.log("  OK — chegou em /agenda");

  console.log("== /agenda render ==");
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  const calRoot = await page.locator(".fc").count();
  console.log(`  .fc count: ${calRoot}`);
  const eventCount = await page.locator(".fc-event").count();
  console.log(`  .fc-event count: ${eventCount}`);

  console.log("== /config ==");
  await page.goto(`${BASE}/config`);
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  const has500 = await page.locator("text=Application error").count();
  console.log(`  Application error visible? ${has500 > 0}`);

  console.log("== /relatorios ==");
  await page.goto(`${BASE}/relatorios`);
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

  console.log("== voltar pra agenda + click no 1o evento (abre modal) ==");
  await page.goto(`${BASE}/agenda`);
  await page.waitForSelector(".fc-event", { timeout: 15_000 });
  await page.locator(".fc-event").first().click({ force: true });
  await page.waitForTimeout(2000);
  const modalOpen = await page.locator('text=Aula').first().isVisible();
  console.log(`  Modal/página aberto? ${modalOpen}`);

  console.log("== toggle Mostrar cancelados ==");
  await page.goto(`${BASE}/agenda?cancelados=1`);
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  const eventsWithCancelled = await page.locator(".fc-event").count();
  console.log(`  Eventos com cancelados: ${eventsWithCancelled}`);

  if (errors.length > 0) {
    console.log("\n== ERROS CAPTURADOS ==");
    for (const e of errors) console.log(" -", e);
  } else {
    console.log("\n== SEM ERROS ==");
  }

  await browser.close();
  process.exit(errors.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("smoke-browser failed:", err);
  process.exit(1);
});
