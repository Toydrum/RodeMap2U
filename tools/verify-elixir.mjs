// «La despedida» (0.0.95) — el elixir. Archiving a FRUITED tree opens the
// despedida ritual («¿qué te llevas?») and distills a vial on «Las despedidas»
// WITHOUT moving the tree's fruits (register intact). Brindar = a closing
// ceremony («Esto te lo llevas» + savor). A FRUITLESS tree keeps the plain
// archive confirm (no elixir).
import { BASE, launchPage, ok } from './lib/harness.mjs';

const { browser, page } = await launchPage();

const db = () =>
  page.evaluate(async () => {
    const open = indexedDB.open('roadmap2u');
    const d = await new Promise((res, rej) => { open.onsuccess = () => res(open.result); open.onerror = rej; });
    const read = (s) => new Promise((res, rej) => {
      const q = d.transaction(s, 'readonly').objectStore(s).getAll();
      q.onsuccess = () => res(q.result); q.onerror = rej;
    });
    const preserves = await read('preserves');
    const harvests = await read('harvests');
    const trees = await read('trees');
    d.close();
    return {
      elixirs: preserves.filter((p) => !p.deletedAt && p.kind === 'elixir'),
      guitarFruits: harvests.filter((h) => !h.deletedAt && h.treeId === 'demo-guitar'),
      guitarHomed: harvests.filter((h) => !h.deletedAt && h.treeId === 'demo-guitar' && h.preserveId).length,
      guitar: trees.find((t) => t.id === 'demo-guitar'),
    };
  });

await page.goto(`${BASE}/forest?seed=demo`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

const before = await db();

// A — archiving a FRUITED tree opens the despedida ritual (not the plain confirm).
await page.locator('.plot:has-text("Aprender guitarra") .plot-archive').click();
await page.waitForTimeout(500);
const despedida = await page.locator('.despedida-sheet').count();
const plainConfirm = await page.locator('.confirm').count();
ok('A fruited tree opens the despedida ritual (not the plain confirm)', despedida === 1 && plainConfirm === 0, `despedida=${despedida} confirm=${plainConfirm}`);

// B — keep the farewell: tree archives + elixir distills, fruits NOT moved.
await page.fill('#carry-field', 'aprendí a ser constante');
await page.locator('.keep-farewell').click();
await page.waitForTimeout(700);
const after = await db();
const elixir = after.elixirs.find((e) => e.treeId === 'demo-guitar');
ok(
  'B despedida distills an elixir + archives the tree, fruits NOT moved',
  !!elixir && elixir.carry === 'aprendí a ser constante' && !!after.guitar?.archivedAt &&
    after.guitarFruits.length === before.guitarFruits.length && after.guitarHomed === before.guitarHomed,
  `elixir=${!!elixir} carry="${elixir?.carry}" archived=${!!after.guitar?.archivedAt} fruits=${before.guitarFruits.length}→${after.guitarFruits.length} homed=${before.guitarHomed}→${after.guitarHomed}`,
);
// dismiss the undo toast (keep the elixir)
await page.locator('.toast .btn-ghost').click().catch(() => {});
await page.waitForTimeout(300);

// C — the vial stands on «Las despedidas»; the register still shows the fruit.
await page.goto(`${BASE}/cosecha`, { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
const vials = await page.locator('.despedidas-shelf .elixir-jar').count();
const registerHasGuitar = (await page.locator('.cosecha-month').allTextContents()).join(' ').includes('Conseguir una guitarra');
ok('C the vial is on «Las despedidas»; the register still shows the tree\'s fruit', vials >= 1 && registerHasGuitar, `vials=${vials} register=${registerHasGuitar}`);

// D — the elixir detail: carry line + Brindar.
await page.locator('.despedidas-shelf .elixir-jar').first().click();
await page.waitForTimeout(400);
const carryLine = ((await page.locator('#elixir-panel .premio-chip').textContent().catch(() => '')) ?? '').trim();
const brindarBtn = await page.locator('#elixir-panel .open-jam-btn').count();
ok('D elixir detail shows «lo que me llevo» + Brindar', /aprend/i.test(carryLine) && brindarBtn === 1, `carry="${carryLine}" brindar=${brindarBtn}`);

// E — the brindis: «Esto te lo llevas» + carry + rain; then it stays «brindado».
await page.locator('#elixir-panel .open-jam-btn').click();
await page.waitForTimeout(500);
await page.locator('.sheet .open-it').click(); // «Brindar»
await page.waitForTimeout(500);
const earned = ((await page.locator('.earned').textContent().catch(() => '')) ?? '');
const rain = await page.locator('.petal-fall').count();
await page.keyboard.press('Escape'); // finish savoring
await page.waitForTimeout(500);
const drunk = await page.evaluate(async () => {
  const open = indexedDB.open('roadmap2u');
  const d = await new Promise((res, rej) => { open.onsuccess = () => res(open.result); open.onerror = rej; });
  const r = await new Promise((res, rej) => { const q = d.transaction('preserves', 'readonly').objectStore('preserves').getAll(); q.onsuccess = () => res(q.result); q.onerror = rej; });
  d.close();
  return r.find((p) => !p.deletedAt && p.kind === 'elixir' && p.treeId === 'demo-guitar')?.openedAt ?? null;
});
const stillOnShelf = await page.locator('.despedidas-shelf .elixir-jar').count();
ok(
  'E brindis: «Esto te lo llevas» + carry + rain, then kept «brindado»',
  earned.includes('Esto te lo llevas') && earned.includes('aprendí a ser constante') && rain === 1 && !!drunk && stillOnShelf >= 1,
  `earned=${earned.includes('Esto te lo llevas')} rain=${rain} drunk=${!!drunk} shelf=${stillOnShelf}`,
);

// F — a FRUITLESS tree keeps the plain archive confirm (no elixir).
await page.goto(`${BASE}/forest?seed=demo`, { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
await page.locator('.plot:has-text("Idea nueva") .plot-archive').click();
await page.waitForTimeout(500);
const plainF = await page.locator('.confirm').count();
const despedidaF = await page.locator('.despedida-sheet').count();
ok('F fruitless tree keeps the plain confirm (no despedida)', plainF === 1 && despedidaF === 0, `confirm=${plainF} despedida=${despedidaF}`);

console.log('elixir done');
await browser.close();
