import { chromium } from 'playwright-core';
const BASE = 'http://localhost:' + (process.env.RM_PORT ?? '8826');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
const out = process.argv[2];
await page.goto(`${BASE}/check-in?seed=demo`, { waitUntil: 'networkidle' });
await page.click('.feeling:has-text("En calma")');
await page.click('button:has-text("Solo quiero mirar")');
await page.click('button:has-text("Aquí estoy")');
// demo seeds a passed date — the gentle review comes first
await page.click('button:has-text("Lo veo después")');
await page.waitForSelector('.ring', { timeout: 5000 });
await page.waitForTimeout(900);
await page.screenshot({ path: `${out}/circle.png` });
await page.click('.ring-tree:has-text("Cuidarme")');
await page.waitForURL('**/tree/**', { timeout: 5000 });
console.log('circle OK — entered:', page.url());
await browser.close();
