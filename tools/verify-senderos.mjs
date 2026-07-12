// «Senderos» (0.0.72): daily repeating step paths. A: the toggle only shows
// on steps parents and persists. B: steps bloomed on a PREVIOUS day quietly
// reset to seed at boot (backdated via IndexedDB — the sweep's real trigger
// is the reactive today()); steps bloomed TODAY are never touched. C: a
// non-repeating path never resets.
import { chromium } from 'playwright-core';
const BASE = 'http://localhost:' + (process.env.RM_PORT ?? '8826');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 900, height: 800 } });

await page.goto(`${BASE}/check-in`, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await page.locator('button', { hasText: 'Empezar' }).click();
await page.waitForTimeout(250);
await page.locator('.skip').click();
await page.waitForURL('**/ahora**');
await page.locator('nav a', { hasText: 'bosque' }).click();
await page.waitForTimeout(400);
await page.locator('button:has-text("Plantar mi primer árbol")').first().click();
await page.fill('#tree-name', 'Mañanas');
await page.locator('form.sheet button[type=submit]').click();
await page.waitForTimeout(400);
const href = await page.evaluate(() => document.querySelector('.plot')?.getAttribute('href'));
await page.goto(`${BASE}${href}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
const center = await page.evaluate(() => {
  const svg = document.querySelector('svg.canvas');
  const rect = svg.getBoundingClientRect();
  const t = (svg.querySelector(':scope > g').getAttribute('transform') ?? '').match(/translate\(([-\d.]+)\s+([-\d.]+)\)\s+scale\(([-\d.]+)\)/);
  const [tx, ty, k] = t ? [Number(t[1]), Number(t[2]), Number(t[3])] : [0, 0, 1];
  const g = svg.querySelector('g.node');
  const nm = (g.getAttribute('transform') ?? '').match(/translate\(([-\d.]+)\s+([-\d.]+)\)/);
  return { x: rect.left + Number(nm[1]) * k + tx, y: rect.top + Number(nm[2]) * k + ty };
});
await page.mouse.click(center.x, center.y);
await page.waitForTimeout(450);
for (const t of ['Despertar', 'Desayunar', 'Vestirme']) {
  const input = page.locator('.add-step input');
  await input.fill(t);
  await input.press('Enter');
  await page.waitForTimeout(200);
}
// A — ordered + repeating (toggle appears only once steps mode is on)
const repeatsBefore = await page.locator('.repeats-toggle').count();
await page.locator('.order-toggle input').check();
await page.waitForTimeout(300);
const repeatsAfter = await page.locator('.repeats-toggle').count();
await page.locator('.repeats-toggle input').check();
await page.waitForTimeout(300);
// bloom the first two steps (today)
for (let i = 0; i < 2; i++) {
  await page.locator('.steps li button', { hasText: '🌸' }).first().click();
  await page.waitForTimeout(280);
}
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
// re-open: repeats persisted?
await page.mouse.click(center.x, center.y);
await page.waitForTimeout(450);
const persisted = await page.locator('.repeats-toggle input').isChecked();
console.log(`A repeats toggle: hidden-before-steps=${repeatsBefore === 0} shows-after=${repeatsAfter === 1} persisted=${persisted} | OK=${repeatsBefore === 0 && repeatsAfter === 1 && persisted}`);
const bloomedToday = await page.locator('.steps .step-name.done').count();
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// B — today's blooms survive a reload untouched…
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(900);
await page.mouse.click(center.x, center.y);
await page.waitForTimeout(450);
const stillToday = await page.locator('.steps .step-name.done').count();
console.log(`B1 today's blooms survive boot: ${stillToday}/${bloomedToday} | OK=${stillToday === bloomedToday && bloomedToday === 2}`);
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// …but YESTERDAY's blooms reset to seed. Backdate achievedAt via IndexedDB.
const backdated = await page.evaluate(async () => {
  const db = await new Promise((res, rej) => {
    const r = indexedDB.open('roadmap2u');
    r.onsuccess = () => res(r.result);
    r.onerror = rej;
  });
  const yesterday = Date.now() - 26 * 3600 * 1000;
  return new Promise((res) => {
    const store = db.transaction('nodes', 'readwrite').objectStore('nodes');
    const all = store.getAll();
    all.onsuccess = () => {
      let n = 0;
      for (const rec of all.result) {
        if (rec.status === 'achieved' && rec.achievedAt) {
          rec.achievedAt = yesterday;
          store.put(rec);
          n++;
        }
      }
      res(n);
    };
  });
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1200); // boot sweep
await page.mouse.click(center.x, center.y);
await page.waitForTimeout(450);
const doneAfter = await page.locator('.steps .step-name.done').count();
const seeds = await page.locator('.steps .status-dot.seed').count();
console.log(`B2 yesterday's blooms reset: backdated=${backdated} done-after=${doneAfter} seeds=${seeds} | OK=${backdated === 2 && doneAfter === 0 && seeds === 3}`);

// C — turning repeats OFF: backdated blooms stay bloomed.
for (let i = 0; i < 2; i++) {
  await page.locator('.steps li button', { hasText: '🌸' }).first().click();
  await page.waitForTimeout(280);
}
await page.locator('.repeats-toggle input').uncheck();
await page.waitForTimeout(300);
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
await page.evaluate(async () => {
  const db = await new Promise((res, rej) => {
    const r = indexedDB.open('roadmap2u');
    r.onsuccess = () => res(r.result);
    r.onerror = rej;
  });
  const yesterday = Date.now() - 26 * 3600 * 1000;
  return new Promise((res) => {
    const store = db.transaction('nodes', 'readwrite').objectStore('nodes');
    const all = store.getAll();
    all.onsuccess = () => {
      for (const rec of all.result) {
        if (rec.status === 'achieved' && rec.achievedAt) {
          rec.achievedAt = yesterday;
          store.put(rec);
        }
      }
      res(null);
    };
  });
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.mouse.click(center.x, center.y);
await page.waitForTimeout(450);
const doneC = await page.locator('.steps .step-name.done').count();
console.log(`C non-repeating never resets: done=${doneC} | OK=${doneC === 2}`);

await browser.close();
console.log('senderos done');
