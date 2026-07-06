// Wide-viewport meadow snapshot: are any trunks standing in the stream?
import { chromium } from 'playwright-core';
const BASE = 'http://localhost:' + (process.env.RM_PORT ?? '8826');
const OUT = process.env.SHOT_DIR ?? 'shots';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1700, height: 800 } });

const names = ['Guitarra', 'Cuidarme', 'Negocio', 'Inglés', 'Cocina', 'Lectura'];
await page.goto(`${BASE}/check-in`, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await page.locator('button', { hasText: 'Empezar' }).click();
await page.waitForTimeout(250);
await page.locator('.skip').click();
await page.waitForURL('**/ahora**');
await page.locator('nav a', { hasText: 'bosque' }).click();
await page.waitForTimeout(400);
for (let i = 0; i < names.length; i++) {
  const opener = i === 0 ? 'Plantar mi primer árbol' : 'Plantar un árbol';
  await page.locator(`button:has-text("${opener}")`).first().click();
  await page.fill('#tree-name', names[i]);
  await page.locator('form.sheet button[type=submit]').click();
  await page.waitForTimeout(180);
}
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/meadow-1700.png` });
await browser.close();
console.log('wide shot done');
