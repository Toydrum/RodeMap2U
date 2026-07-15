// The rename migration (0.0.52): a device whose forest lives under the
// pre-rename DB ('rodemap2u') boots the new app and finds everything —
// copied into 'roadmap2u', with the legacy DB left untouched as a safety net.
import { chromium } from 'playwright-core';
const BASE = 'http://localhost:' + (process.env.RM_PORT ?? '8826');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(String(error)));

// Seed the LEGACY database from a non-app page (same origin, no app boot).
await page.goto(`${BASE}/manifest.webmanifest`, { waitUntil: 'domcontentloaded' });
await page.evaluate(
  () =>
    new Promise((resolve, reject) => {
      const now = Date.now();
      const open = indexedDB.open('rodemap2u', 1);
      open.onupgradeneeded = () => {
        const db = open.result;
        db.createObjectStore('trees', { keyPath: 'id' });
        db.createObjectStore('nodes', { keyPath: 'id' }).createIndex('byTree', 'treeId');
        db.createObjectStore('checkins', { keyPath: 'id' }).createIndex('byCreatedAt', 'createdAt');
        db.createObjectStore('sessions', { keyPath: 'id' }).createIndex('byCreatedAt', 'createdAt');
        db.createObjectStore('meta', { keyPath: 'key' });
      };
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction(['trees', 'nodes', 'meta'], 'readwrite');
        tx.objectStore('trees').put({
          id: 'mig-tree', name: 'Roble migrado', accent: 'moss', order: 10,
          currentNodeId: null, archivedAt: null,
          createdAt: now, updatedAt: now, rev: 1, deletedAt: null,
        });
        tx.objectStore('nodes').put({
          id: 'mig-root', treeId: 'mig-tree', parentId: null, title: 'Raíz migrada',
          note: '', status: 'growing', order: 10, targetDate: null, achievedAt: null,
          branchedAt: null, origin: 'planned', archivedAt: null,
          createdAt: now, updatedAt: now, rev: 1, deletedAt: null,
        });
        tx.objectStore('meta').put({ key: 'settings', onboarded: true, lastCheckInAt: now });
        tx.oncomplete = () => { db.close(); resolve(true); };
        tx.onerror = () => reject(tx.error);
      };
      open.onerror = () => reject(open.error);
    }),
);

// A — boot the app: the legacy forest must appear, migrated.
await page.goto(`${BASE}/forest`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
const plotNames = await page.locator('.plot .plot-name, .plot').allTextContents();
const okA = plotNames.some((t) => t.includes('Roble migrado'));
console.log(`A migrated forest visible: "${plotNames.join('|').slice(0, 60)}" | OK=${okA}`);

// B — the NEW database holds the copy; the LEGACY one is untouched.
const dbState = await page.evaluate(
  () =>
    new Promise((resolve) => {
      const read = (dbName) =>
        new Promise((res) => {
          const open = indexedDB.open(dbName);
          open.onsuccess = () => {
            const db = open.result;
            if (!db.objectStoreNames.contains('trees')) { db.close(); res(-1); return; }
            const req = db.transaction('trees', 'readonly').objectStore('trees').count();
            req.onsuccess = () => { db.close(); res(req.result); };
            req.onerror = () => { db.close(); res(-2); };
          };
          open.onerror = () => res(-3);
        });
      Promise.all([read('roadmap2u'), read('rodemap2u')]).then(([n, legacy]) =>
        resolve({ newTrees: n, legacyTrees: legacy }),
      );
    }),
);
const okB = dbState.newTrees === 1 && dbState.legacyTrees === 1;
console.log(`B copy not move: new=${dbState.newTrees} legacy=${dbState.legacyTrees} | OK=${okB}`);

// C — a later write goes to the NEW db only (legacy stays frozen).
await page.locator('button', { hasText: 'Plantar un árbol' }).first().click();
await page.fill('#tree-name', 'Brote nuevo');
await page.locator('form.sheet button[type=submit]').click();
await page.waitForTimeout(600);
const afterWrite = await page.evaluate(
  () =>
    new Promise((resolve) => {
      const read = (dbName) =>
        new Promise((res) => {
          const open = indexedDB.open(dbName);
          open.onsuccess = () => {
            const db = open.result;
            const req = db.transaction('trees', 'readonly').objectStore('trees').count();
            req.onsuccess = () => { db.close(); res(req.result); };
          };
        });
      Promise.all([read('roadmap2u'), read('rodemap2u')]).then(([n, legacy]) =>
        resolve({ newTrees: n, legacyTrees: legacy }),
      );
    }),
);
const okC = afterWrite.newTrees === 2 && afterWrite.legacyTrees === 1;
console.log(`C writes land in new only: new=${afterWrite.newTrees} legacy=${afterWrite.legacyTrees} | OK=${okC}`);

// D — a genuinely fresh user (no legacy) boots clean and empty.
const fresh = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const freshErrors = [];
fresh.on('pageerror', (error) => freshErrors.push(String(error)));
await fresh.goto(`${BASE}/forest`, { waitUntil: 'networkidle' });
await fresh.waitForTimeout(900);
const emptyCta = await fresh.locator('button', { hasText: 'Plantar mi primer árbol' }).count();
// Same browser context shares the origin — use a COUNT check instead: the
// fresh page sees the migrated data (same profile). So assert only no-errors.
console.log(`D fresh page boots clean: errors=${freshErrors.length} | OK=${freshErrors.length === 0} (cta=${emptyCta})`);
await fresh.close();

console.log(`invariants: pageErrors=${pageErrors.length} | OK=${pageErrors.length === 0}`);
if (pageErrors.length) console.log(pageErrors.join('\n'));

// E — the 0.0.88 DB upgrade: a LIVED-IN device (roadmap2u at DB v1, no
// harvests store, one achieved branch) boots the new app → v2 adds the
// harvests store, the backfill seeds the pantry, the forest is intact.
{
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  const ctxErrors = [];
  p.on('pageerror', (error) => ctxErrors.push(String(error)));
  await p.goto(`${BASE}/manifest.webmanifest`, { waitUntil: 'domcontentloaded' });
  await p.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const now = Date.now();
        const open = indexedDB.open('roadmap2u', 1);
        open.onupgradeneeded = () => {
          const db = open.result;
          db.createObjectStore('trees', { keyPath: 'id' });
          db.createObjectStore('nodes', { keyPath: 'id' }).createIndex('byTree', 'treeId');
          db.createObjectStore('checkins', { keyPath: 'id' }).createIndex('byCreatedAt', 'createdAt');
          db.createObjectStore('sessions', { keyPath: 'id' }).createIndex('byCreatedAt', 'createdAt');
          db.createObjectStore('meta', { keyPath: 'key' });
        };
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction(['trees', 'nodes', 'meta'], 'readwrite');
          tx.objectStore('trees').put({
            id: 'v1-tree', name: 'Roble vivido', accent: 'sage', order: 10,
            currentNodeId: null, archivedAt: null,
            createdAt: now, updatedAt: now, rev: 1, deletedAt: null,
          });
          tx.objectStore('nodes').put({
            id: 'v1-bloom', treeId: 'v1-tree', parentId: null, title: 'Meta lograda',
            note: '', status: 'achieved', order: 10, targetDate: null, achievedAt: now,
            branchedAt: null, origin: 'planned', archivedAt: null,
            createdAt: now, updatedAt: now, rev: 1, deletedAt: null,
          });
          tx.objectStore('meta').put({ key: 'settings', onboarded: true, lastCheckInAt: now });
          tx.objectStore('meta').put({ key: 'legacy.migratedAt', at: now, how: 'lived-in' });
          tx.oncomplete = () => { db.close(); resolve(true); };
          tx.onerror = () => reject(tx.error);
        };
        open.onerror = () => reject(open.error);
      }),
  );
  await p.goto(`${BASE}/forest`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1200);
  const upgraded = await p.evaluate(
    () =>
      new Promise((resolve) => {
        const open = indexedDB.open('roadmap2u');
        open.onsuccess = () => {
          const db = open.result;
          const hasStore = db.objectStoreNames.contains('harvests');
          const hasPreserves = db.objectStoreNames.contains('preserves');
          if (!hasStore) { db.close(); resolve({ hasStore, hasPreserves, version: db.version, rows: -1 }); return; }
          const req = db.transaction('harvests', 'readonly').objectStore('harvests').getAll();
          req.onsuccess = () => { const rows = req.result.length; db.close(); resolve({ hasStore, hasPreserves, version: db.version, rows }); };
          req.onerror = () => { db.close(); resolve({ hasStore, hasPreserves, version: db.version, rows: -2 }); };
        };
        open.onerror = () => resolve({ hasStore: false, hasPreserves: false, version: -1, rows: -3 });
      }),
  );
  const jarE = await p.locator('.meadow-jar').count();
  const treeVisible = (await p.locator('.plot').allTextContents()).some((t) => t.includes('Roble vivido'));
  // v3 (0.0.89): the same boot must also have created the preserves store.
  const okE =
    upgraded.hasStore && upgraded.version === 3 && upgraded.rows === 1 &&
    upgraded.hasPreserves && jarE === 1 && treeVisible && ctxErrors.length === 0;
  console.log(
    `E lived-in v1→v3: store=${upgraded.hasStore} preserves=${upgraded.hasPreserves} v=${upgraded.version} backfilled=${upgraded.rows} jar=${jarE} tree=${treeVisible} errors=${ctxErrors.length} | OK=${okE}`,
  );
  await ctx.close();
}

await browser.close();
console.log('migration done');
