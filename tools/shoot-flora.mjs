// Flora review battery (0.0.64: 16 shapes, 3 cousins per accent): one tree
// per accent with two bloomed pasitos — screenshots of each canvas and the
// meadow for silhouette self-review. Cousins land by tree-id hash, so
// coverage is opportunistic; for the exhaustive per-shape pass, temporarily
// force `flowerFor` to a fixed cousin and re-run.
import { chromium } from 'playwright-core';
const BASE = 'http://localhost:' + (process.env.RM_PORT ?? '8826');
const OUT = process.argv[2] ?? '.';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1100, height: 780 } });

await page.goto(`${BASE}/check-in`, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await page.locator('button', { hasText: 'Empezar' }).click();
await page.waitForTimeout(250);
await page.locator('.skip').click();
await page.waitForURL('**/ahora**');
await page.locator('nav a', { hasText: 'bosque' }).click();
await page.waitForTimeout(400);

async function centers(p) {
  return p.evaluate(() => {
    const svg = document.querySelector('svg.canvas');
    const rect = svg.getBoundingClientRect();
    const t = (svg.querySelector(':scope > g').getAttribute('transform') ?? '').match(
      /translate\(([-\d.]+)\s+([-\d.]+)\)\s+scale\(([-\d.]+)\)/,
    );
    const [tx, ty, k] = t ? [Number(t[1]), Number(t[2]), Number(t[3])] : [0, 0, 1];
    return [...svg.querySelectorAll('g.node')].map((g) => {
      const nm = (g.getAttribute('transform') ?? '').match(/translate\(([-\d.]+)\s+([-\d.]+)\)/);
      return {
        label: (g.getAttribute('aria-label') ?? '').split(' — ')[0],
        x: rect.left + Number(nm[1]) * k + tx,
        y: rect.top + Number(nm[2]) * k + ty,
      };
    });
  });
}
async function findVisible(label) {
  const seek = (all) => all.find((n) => n.label === label || n.label.startsWith(label + ' '));
  let target = seek(await centers(page));
  if (!target) throw new Error(`node not found: ${label}`);
  if (target.x < 24 || target.x > 1076 || target.y < 110 || target.y > 720) {
    await page.locator('.center-btn').click();
    await page.waitForTimeout(500);
    target = seek(await centers(page));
  }
  return target;
}

const ACCENTS = ['moss', 'sage', 'sky', 'clay', 'lavender', 'sand', 'rose', 'pine'];
for (const accent of ACCENTS) {
  const name = 'Flor ' + accent;
  await page.locator('nav a', { hasText: 'bosque' }).click();
  await page.waitForTimeout(400);
  const opener = (await page.locator('button:has-text("Plantar mi primer árbol")').count())
    ? 'Plantar mi primer árbol'
    : 'Plantar un árbol';
  await page.locator(`button:has-text("${opener}")`).first().click();
  await page.fill('#tree-name', name);
  await page.locator(`.accent[aria-label="${accent}"]`).click();
  await page.locator('form.sheet button[type=submit]').click();
  await page.waitForTimeout(300);
  // straight through the href — plot clicks can be intercepted in crowds
  const href = await page.evaluate((n) => {
    const plot = [...document.querySelectorAll('.plot')].find((p) => p.textContent.includes(n));
    return plot?.getAttribute('href');
  }, name);
  await page.goto(`${BASE}${href}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  const root = await findVisible(name);
  await page.mouse.click(root.x, root.y);
  await page.waitForTimeout(420);
  for (const t of ['Uno', 'Dos']) {
    const input = page.locator('input[placeholder*="pasito"]');
    await input.fill(t);
    await input.press('Enter');
    await page.waitForTimeout(160);
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(280);
  const parent = await findVisible(name);
  await page.mouse.click(parent.x, parent.y);
  await page.waitForTimeout(420);
  for (let i = 0; i < 2; i++) {
    await page.locator('.steps li button', { hasText: '🌸' }).first().click();
    await page.waitForTimeout(300);
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await page.locator('.center-btn').click().catch(() => {});
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/flora-${accent}.png` });
  console.log(`shot flora-${accent}`);
}
await page.locator('nav a', { hasText: 'bosque' }).click();
await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}/flora-meadow.png` });
await browser.close();
console.log('flora shots done');
