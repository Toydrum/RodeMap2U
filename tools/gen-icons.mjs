// Render public/icons/logo.svg into the full PWA icon set (replaces the
// Angular-default icons). Maskable-safe: the badge already keeps its content
// inside the safe zone. Usage: node tools/gen-icons.mjs
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const svg = readFileSync(resolve('public/icons/logo.svg'), 'utf-8');

const browser = await chromium.launch({ channel: 'msedge', headless: true });

for (const size of sizes) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  // ~4% breathing room inside the canvas so round masks never kiss the stroke
  const pad = Math.round(size * 0.02);
  await page.setContent(
    `<body style="margin:0;display:grid;place-items:center;width:${size}px;height:${size}px">` +
      `<div style="width:${size - pad * 2}px;height:${size - pad * 2}px">${svg}</div></body>`,
  );
  await page.screenshot({
    path: `public/icons/icon-${size}x${size}.png`,
    omitBackground: true,
  });
  await page.close();
  console.log(`icon-${size}x${size}.png`);
}

await browser.close();
