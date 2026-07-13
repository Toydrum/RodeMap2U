// «Tu bosque, a salvo» (0.0.77). A: the data card shows the honest no-copy
// line. B: the reminder switch persists. C: exporting stamps «Última copia».
// D: with a 31-day-old forest and no copy, ONE gentle toast offers the
// download after the boot delay (opt-out respected by B's round-trip).
import { BASE, launchPage, ok, anyFailed } from './lib/harness.mjs';
const { browser, page } = await launchPage();

await page.goto(`${BASE}/settings?seed=demo`, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);

// A — no copy yet: the honest line.
const mark = (await page.locator('.backup-mark').textContent()).trim();
ok('A no-copy line', mark.includes('no tiene copia'), `"${mark}"`);

// B — the reminder switch flips and persists.
const remRow = page.locator('.row:has-text("Recordarme") .switch');
const before = await remRow.getAttribute('aria-checked');
await remRow.click();
await page.waitForTimeout(400);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(600);
const after = await page.locator('.row:has-text("Recordarme") .switch').getAttribute('aria-checked');
ok('B reminder persists', before === 'true' && after === 'false', `${before} -> ${after}`);
await page.locator('.row:has-text("Recordarme") .switch').click(); // back ON
await page.waitForTimeout(400);

// C — export stamps the last-copy mark.
const dl = page.waitForEvent('download');
await page.locator('button', { hasText: 'Exportar' }).click();
await dl;
await page.waitForTimeout(500);
const marked = (await page.locator('.backup-mark').textContent()).trim();
ok('C export stamps', marked.includes('Última copia'), `"${marked}"`);

// D — a 31-day-old forest with the stamp cleared earns ONE gentle offer.
await page.evaluate(async () => {
  const open = indexedDB.open('roadmap2u');
  const db = await new Promise((res, rej) => { open.onsuccess = () => res(open.result); open.onerror = rej; });
  const age = (store, fn) => new Promise((res, rej) => {
    const tx = db.transaction(store, 'readwrite');
    const os = tx.objectStore(store);
    const all = os.getAll();
    all.onsuccess = () => { fn(os, all.result); tx.oncomplete = () => res(); };
    all.onerror = rej;
  });
  const old = Date.now() - 31 * 24 * 60 * 60 * 1000;
  await age('trees', (os, rows) => rows.forEach((r) => { r.createdAt = old; os.put(r); }));
  await age('meta', (os, rows) => rows.forEach((r) => {
    if (r.key === 'settings') { r.value.lastBackupAt = null; r.value.lastBackupNudgeAt = old; os.put(r); }
  }));
  db.close();
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(9500); // BOOT_DELAY_MS + margin
const toastText = (await page.locator('.toast').textContent().catch(() => '')) ?? '';
ok('D gentle offer', toastText.includes('copia de tu bosque'), `"${toastText.trim().slice(0, 60)}"`);
await page.locator('.toast .btn-ghost').click().catch(() => {});

// E — 0.0.79 arm-first: with NO stamps at all (a synced-in or pre-0.0.77
// forest), the first evaluation arms the 30-day clock SILENTLY — no toast,
// stamp written.
await page.evaluate(async () => {
  const open = indexedDB.open('roadmap2u');
  const db = await new Promise((res, rej) => { open.onsuccess = () => res(open.result); open.onerror = rej; });
  await new Promise((res, rej) => {
    const tx = db.transaction('meta', 'readwrite');
    const os = tx.objectStore('meta');
    const all = os.getAll();
    all.onsuccess = () => {
      for (const r of all.result) {
        if (r.key === 'settings') { r.value.lastBackupAt = null; r.value.lastBackupNudgeAt = null; os.put(r); }
      }
      tx.oncomplete = () => res();
    };
    all.onerror = rej;
  });
  db.close();
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(9500);
const quiet = ((await page.locator('.toast').textContent().catch(() => '')) ?? '').includes('copia de tu bosque');
const armed = await page.evaluate(async () => {
  const open = indexedDB.open('roadmap2u');
  const db = await new Promise((res, rej) => { open.onsuccess = () => res(open.result); open.onerror = rej; });
  const row = await new Promise((res, rej) => {
    const rq = db.transaction('meta').objectStore('meta').get('settings');
    rq.onsuccess = () => res(rq.result);
    rq.onerror = rej;
  });
  db.close();
  return typeof row?.value?.lastBackupNudgeAt === 'number';
});
ok('E arm-first is silent', !quiet && armed, `toast=${quiet} armed=${armed}`);

console.log(`SUMMARY backup: ${anyFailed() ? 'OK=false' : 'ALL OK'}`);
await browser.close();
