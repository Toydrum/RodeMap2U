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
    if (r.key === 'settings') { r.value.lastBackupAt = null; r.value.lastBackupNudgeAt = null; os.put(r); }
  }));
  db.close();
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(9500); // BOOT_DELAY_MS + margin
const toastText = (await page.locator('.toast').textContent().catch(() => '')) ?? '';
ok('D gentle offer', toastText.includes('copia de tu bosque'), `"${toastText.trim().slice(0, 60)}"`);

console.log(`SUMMARY backup: ${anyFailed() ? 'OK=false' : 'ALL OK'}`);
await browser.close();
