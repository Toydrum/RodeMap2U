// Layout truth-finder: opens the forest on a phone-sized viewport with the
// system Edge and reports the real computed geometry of the plots row.
import { chromium } from 'playwright-core';

const url = process.argv[2] ?? 'http://localhost:8788/forest?seed=demo';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForSelector('.plots', { timeout: 15000 });

const report = await page.evaluate(() => {
  const plots = document.querySelector('.plots');
  const style = getComputedStyle(plots);
  const rect = plots.getBoundingClientRect();
  const items = [...plots.querySelectorAll('.plot')].map((el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return { x: Math.round(r.x), w: Math.round(r.width), flex: s.flex, width: s.width };
  });
  return {
    viewport: { w: innerWidth, h: innerHeight },
    plots: {
      x: Math.round(rect.x),
      w: Math.round(rect.width),
      display: style.display,
      flexWrap: style.flexWrap,
      widthRule: style.width,
      maxWidth: style.maxWidth,
    },
    items,
    htmlFontSize: getComputedStyle(document.documentElement).fontSize,
    bodyWidth: document.body.getBoundingClientRect().width,
  };
});

console.log(JSON.stringify(report, null, 2));
await browser.close();
