// Screenshots of the familia card for self-review.
import { chromium } from 'playwright-core';
const BASE = 'http://localhost:' + (process.env.RM_PORT ?? '8826');
const OUT = process.env.SHOT_DIR ?? 'shots';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 960 } });

await page.goto(`${BASE}/account`, { waitUntil: 'networkidle' });
await page.locator('button', { hasText: 'Ya tengo mi llave' }).click();
await page.fill('.auth-form input[autocomplete="username"]', 'rocio');
await page.fill('.auth-form input[type="password"]', 'Bosque123');
await page.locator('.auth-form button[type=submit]').click();
await page.locator('h1', { hasText: 'Tu cuenta' }).waitFor({ timeout: 6000 });

await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
await page.locator('.familia').waitFor();
await page.waitForTimeout(800);
await page.locator('.familia').scrollIntoViewIfNeeded();
await page.screenshot({ path: `${OUT}/familia-card.png` });

await page.locator('.fam-open', { hasText: 'Nico' }).click();
await page.locator('.familia-sheet h2', { hasText: 'Nico' }).waitFor();
await page.screenshot({ path: `${OUT}/familia-child-sheet.png` });
await page.locator('.familia-sheet button', { hasText: 'Cerrar' }).click();

await page.locator('button', { hasText: 'Crear cuenta de peque' }).click();
await page.locator('.familia-sheet h2', { hasText: 'Una cuenta para tu peque' }).waitFor();
await page.fill('.familia-sheet input[autocapitalize="none"]', 'mar');
await page.locator('.familia-sheet .field input').nth(1).fill('Mar');
await page.locator('.familia-sheet button[type=submit]').click();
await page.locator('.familia-sheet h2', { hasText: 'está lista' }).waitFor({ timeout: 8000 });
await page.screenshot({ path: `${OUT}/familia-created.png` });

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
await page.locator('.familia').waitFor();
await page.waitForTimeout(600);
await page.locator('.familia').scrollIntoViewIfNeeded();
await page.screenshot({ path: `${OUT}/familia-mobile.png` });

await browser.close();
console.log('familia shots done');
