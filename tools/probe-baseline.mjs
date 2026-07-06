import { chromium } from 'playwright-core';
const BASE = 'http://localhost:' + (process.env.RM_PORT ?? '8826');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1700, height: 800 } });

await page.goto(`${BASE}/check-in`, { waitUntil: 'networkidle' });
await page.waitForTimeout(300);
await page.locator('button', { hasText: 'Empezar' }).click();
await page.waitForTimeout(200);
await page.locator('.skip').click();
await page.waitForURL('**/ahora**');
await page.locator('nav a', { hasText: 'bosque' }).click();
await page.waitForTimeout(300);
for (let i = 0; i < 6; i++) {
  const opener = i === 0 ? 'Plantar mi primer árbol' : 'Plantar un árbol';
  await page.locator(`button:has-text("${opener}")`).first().click();
  await page.fill('#tree-name', 'Arbol' + i);
  await page.locator('form.sheet button[type=submit]').click();
  await page.waitForTimeout(150);
}
await page.waitForTimeout(400);

const probe = await page.evaluate(() => {
  const scene = document.querySelector('.scene')?.getBoundingClientRect();
  const plots = document.querySelector('.plots')?.getBoundingClientRect();
  const meadow = document.querySelector('.meadow')?.getBoundingClientRect();
  const first = document.querySelector('.plot');
  const style = first ? getComputedStyle(first) : null;
  return {
    sceneBottom: scene?.bottom,
    sceneHeight: scene?.height,
    plotsBottom: plots?.bottom,
    plotsHeight: plots?.height,
    meadowBottom: meadow?.bottom,
    innerH: innerHeight,
    plotBottomStyle: style?.bottom,
  };
});
console.log(JSON.stringify(probe, null, 2));
await browser.close();
