// Variety pass (0.0.61): one tree per accent + same-accent siblings —
// screenshots for self-review + a determinism re-run compare.
import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync } from 'node:fs';
const BASE = 'http://localhost:' + (process.env.RM_PORT ?? '8826');
const OUT = 'tools/shots';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(String(error)));

// Deterministic playground: seed via localStorage flag? No — plant via UI
// with FIXED names; ids are uuids (per-run), so within-run determinism is
// asserted by re-rendering the same page twice and pixel-comparing.
const ACCENTS = ['moss', 'sage', 'sky', 'clay', 'lavender', 'sand', 'rose', 'pine'];

await page.goto(`${BASE}/forest`, { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
for (let i = 0; i < ACCENTS.length; i++) {
  const accent = ACCENTS[i];
  await page.locator('button', { hasText: /Plantar (mi primer árbol|un árbol)/ }).first().click();
  await page.fill('#tree-name', `Especie ${accent}`);
  const swatch = page.locator(`.accent-row .accent`).nth(i);
  if (await swatch.count()) await swatch.click();
  await page.locator('form.sheet button[type=submit]').click();
  await page.waitForTimeout(700);
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(250);
}
// three same-accent siblings (sage → willow family): must differ in porte
for (const name of ['Gemela A', 'Gemela B', 'Gemela C']) {
  await page.locator('button', { hasText: 'Plantar un árbol' }).first().click();
  await page.fill('#tree-name', name);
  const swatch = page.locator(`.accent-row .accent`).nth(1);
  if (await swatch.count()) await swatch.click();
  await page.locator('form.sheet button[type=submit]').click();
  await page.waitForTimeout(700);
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(250);
}
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/variety-meadow-1.png` });

// Grow one tree per NEW family so habits show: sow 6 branches each.
const NAMES = ['Especie sage', 'Especie sky', 'Especie pine', 'Especie moss'];
for (const tree of NAMES) {
  await page.goto(`${BASE}/forest`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  // paginate until the plot is visible
  for (let hop = 0; hop < 4 && !(await page.locator('.plot', { hasText: tree }).count()); hop++) {
    const next = page.locator('.clearing-nav', { hasText: '›' });
    if (!(await next.count())) break;
    await next.click();
    await page.waitForTimeout(500);
  }
  await page.locator('.plot', { hasText: tree }).first().click();
  await page.waitForTimeout(1100);
  await page.locator('.bar .plant').click();
  await page.waitForTimeout(400);
  await page.locator('label', { hasText: 'Varios a la vez' }).click();
  // ONE nested crown — leaders, forks and habits only show on a real crown
  // (bar-sown top-level lines are roots; everything hangs off the first).
  await page.fill(
    '#sow-box',
    [
      'Rama principal',
      '\tHija primera',
      '\t\tNieta alta',
      '\t\tNieta baja',
      '\tHija segunda',
      '\t\tNieta lejana',
      '\tHija tercera',
      '\tHija cuarta',
    ].join('\n'),
  );
  await page.locator('form.sheet button[type=submit]').click();
  await page.waitForTimeout(1000);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1300);
  const slug = tree.split(' ')[1];
  await page.screenshot({ path: `${OUT}/variety-${slug}.png` });
  // determinism: the WOOD GEOMETRY (every limb ribbon + pad) must be
  // byte-identical across reloads. (Pixels can't be compared — clouds
  // drift, the sun breathes; the geometry is the deterministic contract.)
  const woodOf = () =>
    page.evaluate(() =>
      JSON.stringify(
        [...document.querySelectorAll('path.branch')].map((b) => b.getAttribute('d')).sort(),
      ),
    );
  const before = await woodOf();
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1600);
  const after = await woodOf();
  console.log(`determinism ${slug}: identical=${before === after} | OK=${before === after}`);
}

console.log(`invariants: pageErrors=${pageErrors.length} | OK=${pageErrors.length === 0}`);
if (pageErrors.length) console.log(pageErrors.join('\n'));
await browser.close();
console.log('variety done');
