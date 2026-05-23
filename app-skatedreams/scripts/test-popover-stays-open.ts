/**
 * Testa que ao mover o mouse do card para o popover, o popover NÃO fecha.
 * Reproduz o cenário do usuário: hover no card, mouse para o tooltip, interagir.
 */
import { chromium } from "playwright";

const BASE = process.env.PLAYWRIGHT_BASE ?? "http://localhost:3001";
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

  // Pega um evento sobreposto e mede source + popover
  const positions = await page.evaluate(() => {
    const events = Array.from(document.querySelectorAll(".fc-timegrid-event")) as HTMLElement[];
    const byTop = new Map<number, HTMLElement[]>();
    for (const e of events) {
      const t = Math.round(e.getBoundingClientRect().top);
      if (!byTop.has(t)) byTop.set(t, []);
      byTop.get(t)!.push(e);
    }
    const group = [...byTop.values()].find((l) => l.length >= 3);
    if (!group) return null;
    const sorted = group.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
    const source = sorted[0];
    source.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    const sr = source.getBoundingClientRect();
    return {
      sourceTop: sr.top,
      sourceLeft: sr.left,
      sibling1Left: sorted[1].getBoundingClientRect().left,
    };
  });

  if (!positions) {
    console.log("Slot com 3+ eventos não encontrado");
    process.exit(0);
  }

  await page.waitForTimeout(100);

  // Verifica popover existe
  let popoverVisible = await page.locator('[role="dialog"][aria-label="Marcar flags"]').isVisible();
  console.log(`1. Popover aberto após mouseenter: ${popoverVisible ? "✓" : "✗"}`);

  // Move mouse para dentro do popover via mouse.move (gradual)
  // Source visible está em x ~ sourceLeft..sibling1Left
  // Vai do meio do source até o meio do popover, passo a passo
  const startX = positions.sourceLeft + 30;
  const endX = positions.sibling1Left + 50; // dentro do popover (visivel a partir de sibling1Left - 8)
  const y = positions.sourceTop + 20;

  await page.mouse.move(startX, y);
  await page.waitForTimeout(50);
  // Move suavemente
  for (let x = startX; x <= endX; x += 5) {
    await page.mouse.move(x, y);
    await page.waitForTimeout(8);
  }

  await page.waitForTimeout(300);

  popoverVisible = await page.locator('[role="dialog"][aria-label="Marcar flags"]').isVisible();
  console.log(`2. Popover ainda aberto após mover mouse pra ele: ${popoverVisible ? "✓ FICA" : "✗ FECHOU"}`);

  // Tenta clicar num chip pra ver se realmente é interativo
  if (popoverVisible) {
    // Log requests pra ver o que sai
    page.on("request", (req) => {
      if (req.url().includes("/flags")) {
        console.log(`   [REQ] ${req.method()} ${req.url().split('/').slice(-2).join('/')} body=${req.postData()}`);
      }
    });
    page.on("response", async (res) => {
      if (res.url().includes("/flags")) {
        console.log(`   [RES] ${res.status()} ${await res.text().catch(() => "")}`);
      }
    });
    const chip = page.locator('[role="dialog"] button[aria-label="Aluno faltou"]');
    const pressed = await chip.getAttribute("aria-pressed");
    console.log(`   initial aria-pressed: ${pressed}`);
    await page.screenshot({ path: "/tmp/before-click.png" });
    await chip.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: "/tmp/after-click.png" });
    const pressedAfter = await chip.getAttribute("aria-pressed");
    // Também checa via JS direto (não atributo)
    const ariaJs = await chip.evaluate((el) => ({
      ariaAttr: el.getAttribute("aria-pressed"),
      classList: el.className,
      busy: el.classList.contains("opacity-60"),
    }));
    console.log(`   após click: ${JSON.stringify(ariaJs)}`);
    console.log(`3. Click no chip funcionou: aria-pressed ${pressed} → ${pressedAfter} ${pressed !== pressedAfter ? "✓" : "✗"}`);
    // Desfaz se mudou
    if (pressed !== pressedAfter) {
      await chip.click();
      await page.waitForTimeout(300);
    }
  }

  await browser.close();
  process.exit(popoverVisible ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
