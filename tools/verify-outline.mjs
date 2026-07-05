// The "tablita" (0.0.42): branch outline rail — locate on tap, open on
// second tap, ordered-steps numbering, close. Runs on demo data.
import { chromium } from 'playwright-core';
const BASE = 'http://localhost:' + (process.env.RM_PORT ?? '8826');
const browser = await chromium.launch({ channel: 'msedge', headless: true });

// A/B/C/E — demo tree
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(`${BASE}/tree/demo-guitar?seed=demo`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.locator('.tree-outline-toggle').click();
  await page.waitForTimeout(400);
  const rows = await page.locator('.outline-rail .row').count();
  const pinned = (await page.locator('.outline-rail .row:has(.pin)').count()) === 1;
  const indents = await page.evaluate(() =>
    [...document.querySelectorAll('.outline-rail .row')].map((r) => parseInt(r.style.paddingLeft)),
  );
  const hasDepth = new Set(indents).size >= 3;
  console.log(`A rail: rows=${rows} pin=${pinned} depth-levels=${new Set(indents).size} | OK=${rows === 8 && pinned && hasDepth}`);

  // B — first tap locates (focus moves, no sheet)
  const row = page.locator('.outline-rail .row', { hasText: 'Grabarme y escucharme' });
  await row.click();
  await page.waitForTimeout(400);
  const focused = await page.evaluate(
    () => document.querySelector('g.node[tabindex="0"]')?.getAttribute('aria-label') ?? '',
  );
  const noSheet = (await page.locator('#nd-title').count()) === 0;
  const activeRow = await row.evaluate((el) => el.classList.contains('active'));
  console.log(`B locate: focused="${focused.split(' — ')[0]}" no-sheet=${noSheet} row-active=${activeRow} | OK=${focused.startsWith('Grabarme') && noSheet && activeRow}`);

  // C — second tap opens the sheet
  await row.click();
  await page.waitForTimeout(450);
  const title = await page.locator('#nd-title').inputValue().catch(() => null);
  console.log(`C open: sheet="${title}" | OK=${title === 'Grabarme y escucharme'}`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // E — ✕ closes the rail
  await page.locator('.outline-rail .close').click();
  await page.waitForTimeout(300);
  const gone = (await page.locator('.outline-rail').count()) === 0;
  console.log(`E close: rail-gone=${gone} | OK=${gone}`);
  await page.close();
}

// D — ordered steps show their numbering in the outline
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(`${BASE}/check-in`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await page.locator('button', { hasText: 'Empezar' }).click();
  await page.waitForTimeout(250);
  await page.locator('.skip').click();
  await page.waitForURL('**/ahora**');
  await page.locator('nav a', { hasText: 'bosque' }).click();
  await page.waitForTimeout(400);
  await page.locator('button', { hasText: 'Plantar mi primer árbol' }).click();
  await page.fill('#tree-name', 'Ruta');
  await page.locator('form.sheet button[type=submit]').click();
  await page.waitForTimeout(400);
  await page.locator('.plot').first().click();
  await page.waitForTimeout(700);
  await page.locator('svg.canvas g.node').first().click({ force: true });
  await page.waitForTimeout(400);
  for (const t of ['Uno', 'Dos', 'Tres']) {
    const input = page.locator('input[placeholder*="pasito"]');
    await input.fill(t);
    await input.press('Enter');
    await page.waitForTimeout(180);
  }
  await page.locator('.flow-toggle input').check();
  await page.waitForTimeout(250);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await page.locator('.tree-outline-toggle').click();
  await page.waitForTimeout(400);
  const idx = await page.evaluate(() =>
    [...document.querySelectorAll('.outline-rail .row .idx')].map((e) => e.textContent.trim()),
  );
  console.log(`D numbering: [${idx.join(' ')}] | OK=${idx.join(' ') === '1. 2. 3.'}`);
  await page.close();
}

await browser.close();
console.log('outline done');
