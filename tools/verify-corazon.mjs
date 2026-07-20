// «El corazón del árbol» (0.0.112): the first root is the goal's CENTER,
// not a task. A: a heart WITH ramitas leaves the timer picker (a bare one
// stays). B: «+ Plantar aquí» hangs the new ramita from the heart. C: the
// heart's sheet is slim (no picker/luz/fecha/ritmo/🗃) with the derived
// line + pasitos. D: blooming the last ramita OFFERS the whole-tree bloom;
// the action blooms the heart + mints the tree's fruit; Deshacer reverts
// the status and the fruit STAYS. E: renaming the heart renames the tree.
// F: a legacy extra root keeps being an ordinary task.
import { BASE, launchPage, ok } from './lib/harness.mjs';

const { browser, page } = await launchPage();

const idb = (fn, arg) => page.evaluate(fn, arg);
const getAll = (store) =>
  idb(async (s) => {
    const open = indexedDB.open('roadmap2u');
    const db = await new Promise((res, rej) => { open.onsuccess = () => res(open.result); open.onerror = rej; });
    const rows = await new Promise((res, rej) => {
      const rq = db.transaction(s, 'readonly').objectStore(s).getAll();
      rq.onsuccess = () => res(rq.result);
      rq.onerror = rej;
    });
    db.close();
    return rows;
  }, store);

// A — the demo guitar heart ('Tocar guitarra', growing, WITH children) is
// gone from the timer picker; the bare seedling heart stays reachable.
await page.goto(`${BASE}/timer?seed=demo`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
const chips = await page.locator('.node-chips button, .chip-row button, [class*="chip"]').allTextContents();
const chipText = chips.join(' | ');
const heartGone = !chipText.includes('Tocar guitarra');
ok('A container heart out of the picker', heartGone, `chips="${chipText.slice(0, 120)}"`);

// B — «+ Plantar aquí» hangs from the heart.
await page.goto(`${BASE}/tree/demo-work`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
await page.locator('button', { hasText: 'Plantar aquí' }).click();
await page.waitForTimeout(400);
await page.locator('.sow-toggle input').uncheck().catch(() => {});
await page.waitForTimeout(200);
await page.fill('#root-title', 'Ramita nueva');
await page.locator('form.sheet button[type=submit]').click();
await page.waitForTimeout(700);
const nodesB = await getAll('nodes');
const planted = nodesB.find((n) => n.title === 'Ramita nueva');
ok('B plants under the heart', planted?.parentId === 'demo-w-root', `parentId=${planted?.parentId}`);

// C — the heart's sheet is slim. Open it via deep link.
await page.goto(`${BASE}/tree/demo-guitar?node=demo-g-root`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
const heartChip = await page.locator('.heart-chip').count();
const picker = await page.locator('.status-row .chip.pick').count();
const dateField = await page.locator('#nd-date').count();
const repeats = await page.locator('.repeats-toggle').count();
const archiveBtn = await page.locator('.actions button', { hasText: '🗃' }).count();
const focusBtn = await page.locator('.actions button', { hasText: '⏳' }).count();
const heartLine = ((await page.locator('.heart-line').textContent().catch(() => '')) ?? '').trim();
const addStep = await page.locator('.add-step').count();
ok(
  'C slim heart sheet: chip + derived line + pasitos, no task machinery',
  heartChip === 1 && picker === 0 && dateField === 0 && repeats === 0 && archiveBtn === 0 && focusBtn === 0 &&
    /ramitas?/.test(heartLine) && addStep === 1,
  `chip=${heartChip} picker=${picker} date=${dateField} repeats=${repeats} 🗃=${archiveBtn} ⏳=${focusBtn} line="${heartLine}" addStep=${addStep}`,
);
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// E — renaming the heart renames the tree (before D so the fresh tree in D
// stays untouched).
await page.goto(`${BASE}/tree/demo-guitar?node=demo-g-root`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
await page.fill('#nd-title', 'Vivir la música');
await page.locator('#nd-title').blur();
await page.waitForTimeout(600);
const treesE = await getAll('trees');
const treeE = treesE.find((t) => t.id === 'demo-guitar');
ok('E renaming the heart renames the tree', treeE?.name === 'Vivir la música', `name="${treeE?.name}"`);
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// D — a fresh tree: two ramitas, bloom both; the SECOND bloom offers the
// whole-tree door; the action blooms the heart + mints its fruit; Deshacer
// reverts the status and keeps the fruit.
await page.goto(`${BASE}/forest`, { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
await page.locator('button', { hasText: 'Plantar un árbol' }).click();
await page.waitForTimeout(400);
await page.fill('#tree-name', 'Mi reto');
await page.locator('form.sheet button[type=submit]').click();
await page.waitForTimeout(900);
const treesD = await getAll('trees');
const reto = treesD.find((t) => t.name === 'Mi reto');
await page.goto(`${BASE}/tree/${reto.id}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
for (const title of ['Uno', 'Dos']) {
  await page.locator('button', { hasText: 'Plantar aquí' }).click();
  await page.waitForTimeout(350);
  await page.fill('#root-title', title);
  await page.locator('form.sheet button[type=submit]').click();
  await page.waitForTimeout(500);
}
const nodesD = await getAll('nodes');
const heartD = nodesD.filter((n) => n.treeId === reto.id && n.parentId === null)
  .sort((a, b) => a.order - b.order || a.createdAt - b.createdAt)[0];
const ramitas = nodesD.filter((n) => n.treeId === reto.id && n.parentId === heartD.id);
ok('D0 fresh tree: two ramitas under the heart', ramitas.length === 2, `ramitas=${ramitas.length}`);

// Bloom both via each ramita's sheet status picker.
for (const r of ramitas) {
  await page.goto(`${BASE}/tree/${reto.id}?node=${r.id}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  await page.locator('.status-row .chip.pick', { hasText: 'Florecida' }).click();
  await page.waitForTimeout(700);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
}
// The offer queues behind the plain bloom toast — give the queue a beat.
await page.waitForTimeout(1500);
const offerText = ((await page.locator('.toast').textContent().catch(() => '')) ?? '').trim();
const offered = offerText.includes('ya floreció') || offerText.includes('Florece el árbol');
ok('D1 last bloom OFFERS the whole-tree door', offered, `toast="${offerText.slice(0, 80)}"`);
await page.locator('.toast button', { hasText: 'Florece el árbol' }).click();
await page.waitForTimeout(900);
const afterD = await getAll('nodes');
const heartBloomed = afterD.find((n) => n.id === heartD.id)?.status === 'achieved';
const fruitsD = await getAll('harvests');
const treeFruit = fruitsD.find((h) => h.nodeId === heartD.id && !h.deletedAt);
ok('D2 the heart blooms + the tree fruit mints', heartBloomed && !!treeFruit, `achieved=${heartBloomed} fruit=${!!treeFruit}`);
await page.locator('.toast button', { hasText: 'Deshacer' }).click();
await page.waitForTimeout(700);
const undone = await getAll('nodes');
const heartBack = undone.find((n) => n.id === heartD.id)?.status !== 'achieved';
const fruitStays = (await getAll('harvests')).some((h) => h.nodeId === heartD.id && !h.deletedAt);
ok('D3 Deshacer reverts the status, the fruit STAYS', heartBack && fruitStays, `back=${heartBack} fruit=${fruitStays}`);

// F — a legacy extra root (planted via IDB) keeps being an ordinary task.
await idb(async (treeId) => {
  const open = indexedDB.open('roadmap2u');
  const db = await new Promise((res, rej) => { open.onsuccess = () => res(open.result); open.onerror = rej; });
  await new Promise((res, rej) => {
    const tx = db.transaction('nodes', 'readwrite');
    const now = Date.now();
    tx.objectStore('nodes').put({
      id: 'vc-extra-root', createdAt: now, updatedAt: now, rev: 1, deletedAt: null,
      treeId, parentId: null, title: 'Tronco viejo', note: '', status: 'seed',
      order: 999, targetDate: null, achievedAt: null, branchedAt: null,
      origin: 'planned', archivedAt: null, trigger: null,
    });
    tx.oncomplete = () => res();
    tx.onerror = rej;
  });
  db.close();
}, 'demo-health');
await page.goto(`${BASE}/timer`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
const chipsF = (await page.locator('button', { hasText: 'Tronco viejo' }).count()) >= 1;
ok('F legacy extra root stays an ordinary task', chipsF, `inPicker=${chipsF}`);

console.log('corazon done');
await browser.close();
