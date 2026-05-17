/**
 * Testa posicionamento do popover de hover em relação ao card visível,
 * especialmente quando há eventos sobrepostos.
 */
import { chromium } from "playwright";

const BASE = process.env.PLAYWRIGHT_BASE ?? "http://localhost:3002";
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

  // Encontra um slot com vários eventos sobrepostos
  const targetRect = await page.evaluate(() => {
    const events = Array.from(document.querySelectorAll(".fc-timegrid-event")) as HTMLElement[];
    // Agrupa por top, escolhe o primeiro evento de um slot com pelo menos 3 sobreposições
    const byTop = new Map<number, HTMLElement[]>();
    for (const e of events) {
      const t = Math.round(e.getBoundingClientRect().top);
      if (!byTop.has(t)) byTop.set(t, []);
      byTop.get(t)!.push(e);
    }
    const [, group] = [...byTop.entries()].find(([, list]) => list.length >= 3) ?? [];
    if (!group) return null;
    const first = group.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left)[0];
    first.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    const r = first.getBoundingClientRect();
    return {
      sourceLeft: r.left,
      sourceRight: r.right,
      sourceTop: r.top,
      siblingCount: group.length,
      groupLefts: group.map((g) => g.getBoundingClientRect().left).sort((a, b) => a - b),
    };
  });

  if (!targetRect) {
    console.log("Nenhum slot com 3+ eventos sobrepostos");
    process.exit(0);
  }

  console.log("Source:", targetRect);
  await page.waitForTimeout(400);

  // Mede o popover
  const popoverRect = await page.evaluate(() => {
    const pop = document.querySelector('[role="dialog"][aria-label="Marcar flags"]') as HTMLElement | null;
    if (!pop) return null;
    const r = pop.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, width: r.width };
  });

  console.log("Popover:", popoverRect);

  if (!popoverRect) {
    console.log("✗ Popover NÃO renderizou");
    process.exit(1);
  }

  // Espera-se que o popover.left esteja próximo do 2o sibling.left (= visibleRight do source)
  const expectedLeft = targetRect.groupLefts[1];
  const gap = popoverRect.left - expectedLeft;
  console.log(`\nesperado popover.left ≈ ${expectedLeft} (sibling[1].left)`);
  console.log(`recebido popover.left = ${popoverRect.left}`);
  console.log(`gap = ${gap}px ${Math.abs(gap) < 5 ? "✓ COLADO" : "✗ LONGE"}`);

  await browser.close();
  process.exit(Math.abs(gap) < 5 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
