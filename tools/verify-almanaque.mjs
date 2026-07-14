// «El almanaque» (0.0.81). A: the demo's yesterday-dated branch shows its
// capullo + 🍂 on ITS OWN day (owner's golden-rule variant) and the 🍂
// banner lives in Hoy. B: a sendero renders as today's stone path — tapping
// «siguiente» blooms it and Deshacer restores. C: the day page deep-links
// into the branch's tree. D: today wears the green ring; month nav offers
// «Volver a hoy». E: the forest-header 🌾 door navigates.
// (Sendero exclusion from month marks is covered by almanac.spec.ts.)
import { BASE, launchPage, ok } from './lib/harness.mjs';

const { browser, page } = await launchPage();

await page.goto(`${BASE}/almanaque?seed=demo`, { waitUntil: 'networkidle' });
await page.waitForTimeout(900);

// A — yesterday's unresolved fecha amable: leaf on its own cell + Hoy banner.
const banner = await page.locator('.alm-review').count();
const leafCells = await page.locator('.alm-cell .leaf-mark').count();
ok('A passed date stays on its day + banner in Hoy', banner === 1 && leafCells >= 1, `banner=${banner} leafCells=${leafCells}`);

// B — build a sendero via IDB (parent → steps+repeatsDaily), reload: the
// caminito appears; «siguiente» blooms with Deshacer.
await page.evaluate(async () => {
  const open = indexedDB.open('roadmap2u');
  const db = await new Promise((res, rej) => { open.onsuccess = () => res(open.result); open.onerror = rej; });
  await new Promise((res, rej) => {
    const tx = db.transaction('nodes', 'readwrite');
    const os = tx.objectStore('nodes');
    const all = os.getAll();
    all.onsuccess = () => {
      const rows = all.result.filter((r) => !r.deletedAt && !r.archivedAt);
      const byParent = new Map();
      for (const r of rows) {
        if (!r.parentId) continue;
        byParent.set(r.parentId, [...(byParent.get(r.parentId) ?? []), r]);
      }
      const parent = rows.find(
        (r) =>
          (byParent.get(r.id) ?? []).length >= 2 &&
          (r.status === 'seed' || r.status === 'growing'),
      );
      if (!parent) throw new Error('no live parent with 2+ children in demo');
      parent.flow = 'steps';
      parent.repeatsDaily = true;
      os.put(parent);
      for (const child of byParent.get(parent.id)) {
        child.status = 'seed';
        child.achievedAt = null;
        os.put(child);
      }
      tx.oncomplete = () => res();
    };
    all.onerror = rej;
  });
  db.close();
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(900);

const stones = await page.locator('.alm-stone').count();
const nextStone = page.locator('.alm-stone.next');
const hadNext = (await nextStone.count()) === 1;
await nextStone.click();
await page.waitForTimeout(500);
const toastText = (await page.locator('.toast').textContent().catch(() => '')) ?? '';
const bloomedNow = await page.locator('.alm-stone.bloomed').count();
ok('B caminito blooms from the stone', stones >= 2 && hadNext && toastText.includes('floreció') && bloomedNow >= 1, `stones=${stones} toast="${toastText.trim().slice(0, 40)}"`);

await page.locator('.toast button', { hasText: 'Deshacer' }).click();
await page.waitForTimeout(500);
const nextBack = (await page.locator('.alm-stone.next').count()) === 1;
const bloomedAfterUndo = await page.locator('.alm-stone.bloomed').count();
ok('B2 Deshacer restores the stone', nextBack && bloomedAfterUndo === 0, `next=${nextBack} bloomed=${bloomedAfterUndo}`);

// C — the day page: open yesterday's cell (it holds the passed capullo) and
// deep-link into the branch's tree.
await page.locator('.alm-cell .leaf-mark').first().locator('..').click();
await page.waitForTimeout(500);
const sheetUp = await page.locator('.alm-day-sheet').count();
const passedLine = await page.locator('.alm-day-sheet .passed-line').count();
await page.locator('.alm-day-sheet .day-row').first().click();
await page.waitForTimeout(900);
const onTree = page.url().includes('/tree/');
const branchSheet = await page.locator('.sheet').count();
ok('C day page deep-links to the tree', sheetUp === 1 && passedLine >= 1 && onTree && branchSheet >= 1, `url=${page.url().slice(-30)}`);

// D — today ring + «Volver a hoy» after month nav.
await page.goto(`${BASE}/almanaque`, { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
const todayCell = await page.locator('.alm-cell.alm-today').count();
await page.locator('.month-nav .btn-ghost').first().click();
await page.waitForTimeout(300);
const todayGone = (await page.locator('.alm-cell.alm-today').count()) === 0;
await page.locator('.alm-back-today').click();
await page.waitForTimeout(300);
const todayBack = (await page.locator('.alm-cell.alm-today').count()) === 1;
ok('D today ring + Volver a hoy', todayCell === 1 && todayGone && todayBack, `cell=${todayCell}`);

// E2 — a branch dated exactly TODAY gets its own «Hoy quiere florecer» row
// (0.0.82: it lives in no other list — 🍂 is strictly past, upcoming is
// strictly future).
await page.evaluate(async () => {
  const open = indexedDB.open('roadmap2u');
  const db = await new Promise((res, rej) => { open.onsuccess = () => res(open.result); open.onerror = rej; });
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  await new Promise((res, rej) => {
    const tx = db.transaction('nodes', 'readwrite');
    const os = tx.objectStore('nodes');
    const all = os.getAll();
    all.onsuccess = () => {
      // Root branches only — section B turned one demo parent into a
      // sendero, and its steps are (correctly) excluded from todayDated.
      const row = all.result.find(
        (r) => !r.deletedAt && !r.archivedAt && !r.parentId && !r.repeatsDaily && (r.status === 'seed' || r.status === 'growing') && !r.targetDate,
      );
      if (!row) throw new Error('no dateless live ROOT branch in demo');
      row.targetDate = todayKey;
      os.put(row);
      tx.oncomplete = () => res();
    };
    all.onerror = rej;
  });
  db.close();
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(900);
const todayRows = await page.locator('.alm-today-dated .upcoming-row').count();
ok('E2 today-dated branch gets its Hoy row', todayRows >= 1, `rows=${todayRows}`);

// E — the wheat TAB (0.0.86): 5 tabs, none wraps at 360px, and the middle
// one navigates to the almanaque and lights up.
await page.setViewportSize({ width: 360, height: 640 });
await page.goto(`${BASE}/forest`, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
const tabs = await page.locator('.tabbar .tab').count();
const rows = await page.evaluate(() =>
  new Set([...document.querySelectorAll('.tabbar .tab')].map((t) => Math.round(t.getBoundingClientRect().top))).size,
);
await page.locator('.tabbar a[href*="almanaque"]').click();
await page.waitForTimeout(500);
const active = await page.locator('.tabbar a[href*="almanaque"].active').count();
ok('E wheat tab: 5 tabs, one row, navigates + lights', tabs === 5 && rows === 1 && page.url().includes('/almanaque') && active === 1, `tabs=${tabs} rows=${rows}`);

console.log('almanaque done');
await browser.close();
