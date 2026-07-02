// Reliable screenshots with real viewport emulation (system Edge).
// Usage: node tools/shoot.mjs <url> <outfile> [width] [height]
import { chromium } from 'playwright-core';

const [url, out, w = '1280', h = '800'] = process.argv.slice(2);

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(900); // settle animations/fonts
await page.screenshot({ path: out });
await browser.close();
console.log(`saved ${out} (${w}x${h})`);
