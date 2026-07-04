import { chromium } from 'playwright-core';
const BASE = 'http://localhost:' + (process.env.RM_PORT ?? '8826');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 900, height: 800 } });

// A — express with a pending review: review still gets its word, then straight to the meadow
await page.goto(`${BASE}/check-in?seed=demo`, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
const chipText = (await page.locator('.express').textContent()).trim();
await page.locator('.express').click();
await page.waitForSelector('app-date-review, .review, [class*=review]', { timeout: 4000 }).catch(() => {});
const sawReview = await page.locator('button', { hasText: 'Sigo aquí, a mi ritmo' }).count();
await page.locator('button', { hasText: 'Sigo aquí, a mi ritmo' }).click();
await page.waitForURL('**/forest**', { timeout: 5000 });
console.log(`A express+review: chip="${chipText}" review-shown=${sawReview === 1} landed=/forest | OK=${sawReview === 1}`);

// B — express with nothing pending: one tap, straight to the forest
await page.goto(`${BASE}/check-in`, { waitUntil: 'networkidle' });
await page.locator('.express').click();
await page.waitForURL('**/forest**', { timeout: 5000 });
console.log('B express direct: landed=/forest | OK=true');

// C — gentle back: feeling -> where -> back -> feeling -> where -> note -> back -> where
await page.goto(`${BASE}/check-in`, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await page.locator('.feeling').first().click();
await page.waitForSelector('.where-grid');
await page.locator('.step-back').click();
await page.waitForTimeout(300);
const backAtFeeling = (await page.locator('.weather').count()) === 1;
await page.locator('.feeling').nth(1).click();
await page.waitForTimeout(300);
await page.locator('.where').first().click();
await page.waitForSelector('.note');
await page.locator('.step-back').click();
await page.waitForTimeout(300);
const backAtWhere = (await page.locator('.where-grid').count()) === 1;
console.log(`C back: feeling=${backAtFeeling} where=${backAtWhere} | OK=${backAtFeeling && backAtWhere}`);

await browser.close();
