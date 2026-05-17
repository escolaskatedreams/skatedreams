/**
 * Debug: mede o rect real do .fc-event vs o que vemos visualmente,
 * pra entender por que o popover está aparecendo longe do card.
 */
import { chromium } from "playwright";

const BASE = "http://localhost:3001";
const EMAIL = process.env.SEED_EMAIL!;
const PWD = process.env.SEED_PASSWORD!;

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', PWD);
  await page.click('button:has-text("Entrar")');
  await page.waitForURL("**/agenda");
  await page.waitForSelector(".fc-event");

  const data = await page.evaluate(() => {
    const events = Array.from(document.querySelectorAll(".fc-event")).slice(0, 5) as HTMLElement[];
    return events.map((el, i) => {
      const r = el.getBoundingClientRect();
      const harness = el.closest(".fc-timegrid-event-harness") as HTMLElement | null;
      const hr = harness?.getBoundingClientRect();
      const summary = el.querySelector(".font-semibold")?.textContent?.trim() ?? el.textContent?.trim().slice(0, 30);
      return {
        i,
        title: summary,
        eventRect: { top: r.top, left: r.left, right: r.right, width: r.width },
        harnessRect: hr ? { top: hr.top, left: hr.left, right: hr.right, width: hr.width } : null,
        offsetWidth: el.offsetWidth,
        offsetLeft: el.offsetLeft,
      };
    });
  });

  console.log("Viewport:", await page.viewportSize());
  console.log(JSON.stringify(data, null, 2));

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
