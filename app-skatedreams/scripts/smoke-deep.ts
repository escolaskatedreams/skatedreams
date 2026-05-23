import { chromium } from "playwright";

const BASE = "http://localhost:3001";
const EMAIL = process.env.SEED_EMAIL!;
const PWD = process.env.SEED_PASSWORD!;

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  const errors: string[] = [];
  const responses: Array<{ url: string; status: number }> = [];
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`console.error: ${m.text()}`); });
  page.on("response", (r) => { if (r.status() >= 400) responses.push({ url: r.url(), status: r.status() }); });

  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', PWD);
  await page.click('button:has-text("Entrar")');
  await page.waitForURL("**/agenda");

  console.log("== Visit all routes ==");
  for (const url of ["/", "/agenda", "/agenda?cancelados=1", "/config", "/relatorios", "/relatorios?from=2026-04-01&to=2026-05-31"]) {
    await page.goto(`${BASE}${url}`);
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    console.log(`  ${url}: ${page.url()}`);
  }

  console.log("== Click sync button on /config ==");
  await page.goto(`${BASE}/config`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.click('button:has-text("Sincronizar agora")').catch((e) => console.log("  click failed:", e.message));
  await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
  console.log("  after sync:", page.url());

  console.log("== Click event then standalone /aula/[id] ==");
  await page.goto(`${BASE}/agenda`);
  await page.waitForSelector(".fc-event");
  const firstEventHandle = page.locator(".fc-event").first();
  await firstEventHandle.click({ force: true });
  await page.waitForTimeout(2000);
  console.log("  url after click:", page.url());

  if (responses.length > 0) {
    console.log("\n== HTTP ERRORS ==");
    for (const r of responses) console.log(` - ${r.status} ${r.url}`);
  }
  if (errors.length > 0) {
    console.log("\n== JS ERRORS ==");
    for (const e of errors) console.log(" -", e);
  }
  if (responses.length === 0 && errors.length === 0) console.log("\n== TUDO LIMPO ==");
  await browser.close();
}
main().catch(console.error);
