// «La campanita» (0.0.111): per-branch reminder hours. A: setting an hour in
// the node sheet persists remindAt (and the block is ALWAYS visible — no
// fold). B: an hour that passed within the ≤60 min grace fires ONE toast
// with the user's own phrase; the fired-marker holds (no second toast the
// same day). C: a resting branch stays quiet at its hour.
import { BASE, launchPage, ok } from './lib/harness.mjs';

const { browser, page } = await launchPage();

await page.goto(`${BASE}/tree/demo-guitar?seed=demo&node=demo-g-first-song`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

// A — the block is visible without any fold; setting an hour persists.
const triggerVisible = (await page.locator('#nd-trigger').count()) === 1;
const remindVisible = (await page.locator('#nd-remind').count()) === 1;
await page.fill('#nd-trigger', 'Cuando me sirva el café');
await page.locator('#nd-trigger').blur();
await page.waitForTimeout(300);
await page.fill('#nd-remind', '08:30');
await page.locator('#nd-remind').blur();
await page.waitForTimeout(500);
const savedA = await page.evaluate(async () => {
  const open = indexedDB.open('roadmap2u');
  const db = await new Promise((res, rej) => { open.onsuccess = () => res(open.result); open.onerror = rej; });
  const row = await new Promise((res, rej) => {
    const rq = db.transaction('nodes', 'readonly').objectStore('nodes').get('demo-g-first-song');
    rq.onsuccess = () => res(rq.result);
    rq.onerror = rej;
  });
  db.close();
  return { remindAt: row?.remindAt ?? null, trigger: row?.trigger ?? null };
});
ok(
  'A remind block visible (no fold) + hour persists',
  triggerVisible && remindVisible && savedA.remindAt === '08:30' && savedA.trigger === 'Cuando me sirva el café',
  `visible=${triggerVisible}/${remindVisible} remindAt=${savedA.remindAt}`,
);

// B — an hour 10 minutes ago (inside the grace) fires ONE toast with the
// phrase; the fired-marker keeps a second reload quiet the same day.
await page.evaluate(async () => {
  const open = indexedDB.open('roadmap2u');
  const db = await new Promise((res, rej) => { open.onsuccess = () => res(open.result); open.onerror = rej; });
  await new Promise((res, rej) => {
    const tx = db.transaction('nodes', 'readwrite');
    const os = tx.objectStore('nodes');
    const rq = os.get('demo-g-first-song');
    rq.onsuccess = () => {
      const row = rq.result;
      const d = new Date(Date.now() - 10 * 60 * 1000);
      row.remindAt = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      os.put(row);
    };
    tx.oncomplete = () => res();
    tx.onerror = rej;
  });
  db.close();
});
await page.goto(`${BASE}/forest`, { waitUntil: 'networkidle' });
await page.waitForTimeout(5500); // the boot late-fire check runs at ~4 s
const toastB = ((await page.locator('.toast .msg').textContent().catch(() => '')) ?? '').trim();
const firedB = toastB.includes('Cuando me sirva el café') && toastB.includes('te espera');
ok('B past-hour-within-grace fires the phrase', firedB, `"${toastB.slice(0, 60)}"`);
await page.locator('.toast .btn-ghost').click().catch(() => {});

await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(5500);
const toastB2 = ((await page.locator('.toast .msg').textContent().catch(() => '')) ?? '').trim();
ok('B2 fired once per day (second boot stays quiet)', !toastB2.includes('te espera'), `"${toastB2.slice(0, 40)}"`);

// C — a RESTING branch stays quiet at its hour (live branches only).
await page.evaluate(async () => {
  const open = indexedDB.open('roadmap2u');
  const db = await new Promise((res, rej) => { open.onsuccess = () => res(open.result); open.onerror = rej; });
  await new Promise((res, rej) => {
    const tx = db.transaction(['nodes', 'meta'], 'readwrite');
    const nodes = tx.objectStore('nodes');
    const rq = nodes.get('demo-g-first-song');
    rq.onsuccess = () => {
      const row = rq.result;
      row.status = 'resting';
      nodes.put(row);
    };
    tx.objectStore('meta').delete('reminders.fired'); // fresh day, same hour
    tx.oncomplete = () => res();
    tx.onerror = rej;
  });
  db.close();
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(5500);
const toastC = ((await page.locator('.toast .msg').textContent().catch(() => '')) ?? '').trim();
ok('C resting branch stays quiet', !toastC.includes('te espera'), `"${toastC.slice(0, 40)}"`);

console.log('recordatorio done');
await browser.close();
