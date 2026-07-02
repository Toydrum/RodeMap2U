// Interactive verification: open a node's detail sheet, launch the branch
// flow, screenshot both — proves the compass copy + always-available sprout.
import { chromium } from 'playwright-core';

const base = process.argv[2] ?? 'http://localhost:8790';
const outDir = process.argv[3] ?? '.';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 900, height: 900 } });

await page.goto(`${base}/tree/demo-health?seed=demo`, { waitUntil: 'networkidle' });
await page.waitForSelector('[data-node-id="demo-h-walk"]', { timeout: 15000 });

// First click focuses, second opens the detail sheet.
await page.click('[data-node-id="demo-h-walk"]');
await page.click('[data-node-id="demo-h-walk"]');
await page.waitForSelector('.sheet', { timeout: 5000 });
await page.waitForTimeout(500);
await page.screenshot({ path: `${outDir}/node-detail.png` });

// Launch the branch flow from the always-available sprout button.
await page.click('button:has-text("Brotar ramitas nuevas")');
await page.waitForSelector('.modal', { timeout: 5000 });
await page.waitForTimeout(400);
await page.screenshot({ path: `${outDir}/branch-flow.png` });

// Tap a suggestion chip to prove prefill works.
await page.click('button.suggestion:has-text("Más pequeño")');
await page.waitForTimeout(300);
await page.screenshot({ path: `${outDir}/branch-flow-suggestion.png` });

await browser.close();
console.log('saved node-detail.png, branch-flow.png, branch-flow-suggestion.png');
