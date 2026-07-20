// «La cosecha» (0.0.88). G: the demo forest wakes up with its pantry
// (backfill sentinel + jar born full). C: the jar wins its own taps and
// walks to /cosecha. D: the pantry page shelves months and deep-links to
// the branch. A: blooming a pasito plays the burst + the canvas fruit
// drop + the toast, and mints a harvest. B: the status picker celebrates
// too (the 0.0.88 silent-picker fix), and reopening keeps the fruit (the
// pantry register — owner decision). E: sendero stones celebrate the ACT
// but never mint. H: reduce-motion keeps the reward, drops the motion.
// F (fresh launch): no jar before the first fruit.
import { BASE, launchPage, ok } from './lib/harness.mjs';

const { browser, page } = await launchPage();

const harvestCount = () =>
  page.evaluate(async () => {
    const open = indexedDB.open('roadmap2u');
    const db = await new Promise((res, rej) => {
      open.onsuccess = () => res(open.result);
      open.onerror = rej;
    });
    const rows = await new Promise((res, rej) => {
      const req = db.transaction('harvests', 'readonly').objectStore('harvests').getAll();
      req.onsuccess = () => res(req.result);
      req.onerror = rej;
    });
    db.close();
    return rows.filter((r) => !r.deletedAt).length;
  });

await page.goto(`${BASE}/forest?seed=demo`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1100);

// G — backfill: sentinel sealed + the demo's achieved branches seeded fruit.
const backfill = await page.evaluate(async () => {
  const open = indexedDB.open('roadmap2u');
  const db = await new Promise((res, rej) => {
    open.onsuccess = () => res(open.result);
    open.onerror = rej;
  });
  const sentinel = await new Promise((res, rej) => {
    const req = db.transaction('meta', 'readonly').objectStore('meta').get('harvests.backfilledAt');
    req.onsuccess = () => res(req.result);
    req.onerror = rej;
  });
  db.close();
  return { sealed: !!sentinel, seeded: sentinel?.seeded ?? 0 };
});
const countAfterBackfill = await harvestCount();
ok('G backfill seals + seeds the demo pantry', backfill.sealed && countAfterBackfill > 0, `seeded=${backfill.seeded} rows=${countAfterBackfill}`);

// C (0.0.99 — the meadow jar was REMOVED): the meadow shows NO jar; the
// Conservería TAB is the door and walks to /cosecha with the hero jar full.
const jarCount = await page.locator('.meadow-jar').count();
await page.locator('nav.tabbar a[href*="cosecha"]').click();
await page.waitForTimeout(600);
const heroFruit = await page.locator('.hero-jar .jar-fruit').count();
ok(
  'C meadow jar gone; the Conservería tab walks to /cosecha (hero jar full)',
  jarCount === 0 && page.url().includes('/cosecha') && heroFruit >= 1,
  `meadowJar=${jarCount} heroFruit=${heroFruit} url=${page.url().slice(-16)}`,
);

// D — month shelves + a live row deep-links into the branch's tree.
const months = await page.locator('.cosecha-month').count();
const totalLine = await page.locator('.total-line').count();
await page.locator('button.cosecha-row').first().click();
await page.waitForTimeout(900);
// The tree page consumes ?node= (opens the sheet, strips the param) — the
// verify-almanaque C precedent: assert the destination + the open sheet.
const onTree = page.url().includes('/tree/');
const sheetOpen = await page.locator('.sheet').count();
ok('D pantry shelves + row deep-links', months >= 1 && totalLine === 1 && onTree && sheetOpen >= 1, `months=${months} url=${page.url().slice(-40)}`);

// A — bloom a pasito from the node sheet: burst + canvas drop + toast + mint.
// Find a parent with an unbloomd child OUTSIDE any sendero (none exist yet).
const siteA = await page.evaluate(async () => {
  const open = indexedDB.open('roadmap2u');
  const db = await new Promise((res, rej) => {
    open.onsuccess = () => res(open.result);
    open.onerror = rej;
  });
  const rows = await new Promise((res, rej) => {
    const req = db.transaction('nodes', 'readonly').objectStore('nodes').getAll();
    req.onsuccess = () => res(req.result);
    req.onerror = rej;
  });
  db.close();
  const live = rows.filter((r) => !r.deletedAt && !r.archivedAt);
  const kids = new Map();
  for (const r of live) {
    if (!r.parentId) continue;
    kids.set(r.parentId, [...(kids.get(r.parentId) ?? []), r]);
  }
  for (const parent of live) {
    const open = (kids.get(parent.id) ?? []).filter(
      (c) => c.status === 'seed' || c.status === 'growing',
    );
    if (open.length) return { treeId: parent.treeId, parentId: parent.id, childId: open[0].id };
  }
  return null;
});
ok('A demo offers an unbloomd pasito', !!siteA, siteA ? siteA.parentId : 'none');

const before = await harvestCount();
await page.goto(`${BASE}/tree/${siteA.treeId}?node=${siteA.parentId}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.locator('button[aria-label^="Florecida"]').first().click();
await page.waitForTimeout(200);
const burstA = await page.locator('.bloom-burst').count();
const dropA = await page.locator('.fruit-drop').count();
const toastA = ((await page.locator('.toast .msg').textContent().catch(() => '')) ?? '').includes('floreció');
await page.waitForTimeout(3000);
const dropGone = (await page.locator('.fruit-drop').count()) === 0;
const afterA = await harvestCount();
ok(
  'A pasito bloom: burst + drop + toast + mint',
  burstA >= 1 && dropA >= 1 && toastA && dropGone && afterA === before + 1,
  `burst=${burstA} drop=${dropA} toast=${toastA} mint=${before}→${afterA}`,
);

// B — the status picker celebrates (the silent-picker fix), and REOPENING
// keeps the fruit in the jar (pantry register: memories survive). A fresh
// node — §A just bloomed the parent's first open pasito, so pick another
// live non-achieved branch (any tree).
const siteB = await page.evaluate(async () => {
  const open = indexedDB.open('roadmap2u');
  const db = await new Promise((res, rej) => {
    open.onsuccess = () => res(open.result);
    open.onerror = rej;
  });
  const rows = await new Promise((res, rej) => {
    const req = db.transaction('nodes', 'readonly').objectStore('nodes').getAll();
    req.onsuccess = () => res(req.result);
    req.onerror = rej;
  });
  db.close();
  const pick = rows.find(
    (r) =>
      !r.deletedAt && !r.archivedAt && !r.repeatsDaily && r.parentId !== null &&
      (r.status === 'seed' || r.status === 'growing'),
  );
  return pick ? { treeId: pick.treeId, nodeId: pick.id } : null;
});
ok('B has a fresh live branch', !!siteB, siteB ? siteB.nodeId : 'none');
await page.goto(`${BASE}/tree/${siteB.treeId}?node=${siteB.nodeId}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.locator('.status-row .chip.pick', { hasText: 'Florecida' }).click();
await page.waitForTimeout(200);
const burstB = await page.locator('.bloom-burst').count();
// With a pending promise jar in the demo (0.0.106), the storage offer
// REPLACES the plain bloom toast (the 0.0.65 replace rule) — both voices
// celebrate the same bloom, either is correct here.
const toastBText = (await page.locator('.toast .msg').textContent().catch(() => '')) ?? '';
const toastB = toastBText.includes('floreció') || toastBText.includes('guardas');
const afterB = await harvestCount();
// Let the bloom toast AND the queued «¿La guardas en tu frasco…?» offer
// breathe out — the 0.0.106 demo seed ships a pending promise jar, so every
// bloom now queues the storage offer behind the celebration (by design).
await page.waitForTimeout(12500);
await page.locator('.status-row .chip.pick', { hasText: 'Creciendo' }).click();
await page.waitForTimeout(400);
const toastReopen = await page.locator('.toast').count();
const afterReopen = await harvestCount();
ok(
  'B picker celebrates; reopen is quiet and KEEPS the fruit',
  burstB >= 1 && toastB && afterB === afterA + 1 && toastReopen === 0 && afterReopen === afterB,
  `burst=${burstB} mint=${afterA}→${afterB} reopenToast=${toastReopen} kept=${afterReopen === afterB}`,
);

// E — sendero stones: the burst celebrates the ACT, the pantry stays out.
const senderoTitleE = await page.evaluate(async () => {
  const open = indexedDB.open('roadmap2u');
  const db = await new Promise((res, rej) => {
    open.onsuccess = () => res(open.result);
    open.onerror = rej;
  });
  const title = await new Promise((res, rej) => {
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
      // Skip parents that are already rituals — the 0.0.106 demo seed ships
      // its own caminito; this probe builds a sendero of its OWN.
      const parent = rows.find(
        (r) =>
          (byParent.get(r.id) ?? []).length >= 2 &&
          (r.status === 'seed' || r.status === 'growing') &&
          !r.repeatsDaily && r.repeats == null,
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
      tx.oncomplete = () => res(parent.title);
    };
    all.onerror = rej;
  });
  db.close();
  return title;
});
await page.goto(`${BASE}/almanaque`, { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
const beforeStone = await harvestCount();
// Scope to OUR caminito — the demo seed walks its own since 0.0.106.
await page.locator('.caminito', { hasText: senderoTitleE }).locator('.alm-stone.next').click();
await page.waitForTimeout(200);
const burstE = await page.locator('.bloom-burst').count();
const toastE = ((await page.locator('.toast .msg').textContent().catch(() => '')) ?? '').includes('floreció');
const afterStone = await harvestCount();
ok(
  'E stone celebrates the act, never mints',
  burstE >= 1 && toastE && afterStone === beforeStone,
  `burst=${burstE} toast=${toastE} mint=${beforeStone}→${afterStone}`,
);

// H — reduce-motion: the reward exists, the motion steps aside. Fresh
// query AT H TIME with the sendero exclusion — §E just senderoized a
// parent, and its pasitos (correctly) drop no fruit.
const siteH = await page.evaluate(async () => {
  const open = indexedDB.open('roadmap2u');
  const db = await new Promise((res, rej) => {
    open.onsuccess = () => res(open.result);
    open.onerror = rej;
  });
  const rows = await new Promise((res, rej) => {
    const req = db.transaction('nodes', 'readonly').objectStore('nodes').getAll();
    req.onsuccess = () => res(req.result);
    req.onerror = rej;
  });
  db.close();
  const byId = new Map(rows.map((r) => [r.id, r]));
  const underDaily = (n) => {
    let cur = n;
    const seen = new Set();
    while (cur?.parentId && !seen.has(cur.parentId)) {
      seen.add(cur.parentId);
      const parent = byId.get(cur.parentId);
      if (!parent) return false;
      if (parent.repeatsDaily && parent.flow === 'steps' && parent.status !== 'branched') return true;
      cur = parent;
    }
    return false;
  };
  const pick = rows.find(
    (r) =>
      !r.deletedAt && !r.archivedAt && !r.repeatsDaily && r.parentId !== null &&
      (r.status === 'seed' || r.status === 'growing') && !underDaily(r),
  );
  return pick ? { treeId: pick.treeId, nodeId: pick.id } : null;
});
ok('H has a fruit-bearing branch', !!siteH, siteH ? siteH.nodeId : 'none');
await page.emulateMedia({ reducedMotion: 'reduce' });
await page.goto(`${BASE}/tree/${siteH.treeId}?node=${siteH.nodeId}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
const htmlReduced = await page.evaluate(() =>
  document.documentElement.classList.contains('reduce-motion'),
);
await page.locator('.status-row .chip.pick', { hasText: 'Florecida' }).click();
await page.waitForTimeout(200);
const burstH = await page.locator('.bloom-burst').count();
const petalHidden = await page.evaluate(() => {
  const petal = document.querySelector('.burst-petal');
  return petal ? getComputedStyle(petal).display === 'none' : false;
});
const fallStill = await page.evaluate(() => {
  const fall = document.querySelector('.fruit-drop .fruit-fall');
  return fall ? getComputedStyle(fall).animationName === 'none' : false;
});
ok(
  'H reduce-motion: ring only + fruit at rest',
  htmlReduced && burstH >= 1 && petalHidden && fallStill,
  `reduced=${htmlReduced} burst=${burstH} petalsHidden=${petalHidden} still=${fallStill}`,
);

await browser.close();

// F (0.0.99) — the meadow never holds a jar (removed for good; the
// Conservería tab is the one door).
{
  const { browser: b2, page: p2 } = await launchPage();
  await p2.goto(`${BASE}/forest`, { waitUntil: 'networkidle' });
  await p2.waitForTimeout(800);
  const jarFresh = await p2.locator('.meadow-jar').count();
  ok('F the meadow never holds a jar', jarFresh === 0, `jar=${jarFresh}`);
  await b2.close();
}

console.log('cosecha done');
