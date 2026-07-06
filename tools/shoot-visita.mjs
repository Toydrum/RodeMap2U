// Screenshots of the co-gardening surfaces.
import { chromium } from 'playwright-core';
const BASE = 'http://localhost:' + (process.env.RM_PORT ?? '8826');
const OUT = process.env.SHOT_DIR ?? 'shots';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });

await page.goto(`${BASE}/account`, { waitUntil: 'networkidle' });
await page.locator('button', { hasText: 'Ya tengo mi llave' }).click();
await page.fill('.auth-form input[autocomplete="username"]', 'rocio');
await page.fill('.auth-form input[type="password"]', 'Bosque123');
await page.locator('.auth-form button[type=submit]').click();
await page.locator('h1', { hasText: 'Tu cuenta' }).waitFor({ timeout: 6000 });

await page.goto(`${BASE}/visit/mock-child`, { waitUntil: 'networkidle' });
await page.locator('h1', { hasText: 'El jardín de Nico' }).waitFor({ timeout: 8000 });
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/visita-forest.png` });

await page.locator('.visita-plot').first().click();
await page.locator('app-tree-canvas').waitFor({ timeout: 8000 });
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/visita-tree.png` });

await browser.close();
console.log('visita shots done');
