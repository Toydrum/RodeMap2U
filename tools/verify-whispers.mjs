import { chromium } from 'playwright-core';
const BASE = 'http://localhost:' + (process.env.RM_PORT ?? '8826');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 900, height: 800 } });
await context.grantPermissions(['notifications']);
const page = await context.newPage();

// A — settings toggle: rhythm appears, choice persists across reload
await page.goto(`${BASE}/settings?seed=demo`, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await page.locator('#whispers-toggle').click();
await page.waitForTimeout(300);
const rhythmShown = (await page.locator('button', { hasText: 'Una vez al día' }).count()) === 1;
await page.locator('button', { hasText: 'Seguido (~2 h)' }).click();
await page.waitForTimeout(300);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(400);
const stillOn = (await page.locator('#whispers-toggle').getAttribute('aria-checked')) === 'true';
const rhythmKept = (await page.locator('.chip.opt.selected', { hasText: 'Seguido' }).count()) === 1;
console.log(`A toggle: rhythm-shown=${rhythmShown} persisted-on=${stillOn} rhythm-kept=${rhythmKept} | OK=${rhythmShown && stillOn && rhythmKept}`);

// B — an in-app whisper is a QUESTION with an answer door to the check-in
await page.goto(`${BASE}/ahora?whisper=now`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
const msg = (await page.locator('.toast .msg').textContent()).trim();
const isQuestion = msg.includes('¿') && !/sesi|rama|pasito|min/i.test(msg);
await page.locator('.toast .btn-primary', { hasText: 'Contestar' }).click();
await page.waitForURL('**/check-in**', { timeout: 5000 });
console.log(`B whisper: "${msg}" question-not-task=${isQuestion} answer->check-in | OK=${isQuestion}`);

// C — the custom SW (sw.js wrapping ngsw) is the registered worker
await page.goto(`${BASE}/ahora`, { waitUntil: 'networkidle' });
const swUrl = await page
  .evaluate(async () => {
    for (let i = 0; i < 20; i++) {
      const reg = await navigator.serviceWorker.getRegistration();
      const url = reg?.active?.scriptURL ?? reg?.installing?.scriptURL ?? reg?.waiting?.scriptURL;
      if (url) return url;
      await new Promise((r) => setTimeout(r, 500));
    }
    return 'none';
  })
  .catch(() => 'error');
console.log(`C service worker: ${swUrl} | OK=${swUrl.endsWith('/sw.js')}`);

await browser.close();
