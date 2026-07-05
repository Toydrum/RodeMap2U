// The natural meadow (0.0.43): scattered clearings — sky safety, determinism,
// drag-that-moves-trees, arrows/dots pagination, mobile fit.
import { chromium } from 'playwright-core';
const BASE = 'http://localhost:' + (process.env.RM_PORT ?? '8826');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

const names = ['Guitarra', 'Cuidarme', 'Negocio', 'Inglés', 'Cocina', 'Lectura', 'Amigos', 'Jardín', 'Dibujo', 'Ahorro', 'Fotos', 'Huerto', 'Yoga', 'Piano', 'Viaje', 'Club'];
let planted = 0;

await page.goto(`${BASE}/check-in`, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await page.locator('button', { hasText: 'Empezar' }).click();
await page.waitForTimeout(250);
await page.locator('.skip').click();
await page.waitForURL('**/ahora**');
await page.locator('nav a', { hasText: 'bosque' }).click();
await page.waitForTimeout(400);

async function plantUpTo(n) {
  while (planted < n) {
    const opener = planted === 0 ? 'Plantar mi primer árbol' : 'Plantar un árbol';
    await page.locator(`button:has-text("${opener}")`).first().click();
    await page.fill('#tree-name', names[planted]);
    await page.locator('form.sheet button[type=submit]').click();
    await page.waitForTimeout(180);
    planted++;
  }
  await page.waitForTimeout(300);
  while (await page.locator('.clearing-nav.prev:not([disabled])').count()) {
    await page.locator('.clearing-nav.prev').click();
    await page.waitForTimeout(220);
  }
}

const plotRects = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('.plot')].map((p) => {
      const r = p.getBoundingClientRect();
      return { id: p.dataset.treeId, top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right) };
    }),
  );

// A — sky safety across sizes + every visible tree keeps a tappable heart
// (elementFromPoint at its center resolves to ITSELF — the archive regression).
for (const n of [1, 5, 10, 16]) {
  await plantUpTo(n);
  const rects = await plotRects();
  const skyline = await page.evaluate(() => innerHeight - Math.min(430, 0.54 * innerHeight) - 160);
  const minTop = Math.min(...rects.map((r) => r.top));
  const arrows = await page.locator('.clearing-nav').count();
  const dots = await page.locator('.clearing-dots .dot').count();
  const expectPages = Math.ceil(n / 6);
  const hearts = await page.evaluate(() =>
    [...document.querySelectorAll('.plot')].every((p) => {
      const r = p.getBoundingClientRect();
      const el = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2);
      return el?.closest('[data-tree-id]') === p;
    }),
  );
  const ok = minTop > skyline && hearts && (expectPages > 1 ? arrows === 2 && dots === expectPages : arrows === 0);
  console.log(`A n=${n}: visible=${rects.length} minTop=${minTop} (skyline<${Math.round(skyline)}) hearts=${hearts} arrows=${arrows} dots=${dots} | OK=${ok}`);
}

// B — determinism: same rects across a reload.
const before = await plotRects();
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(600);
while (await page.locator('.clearing-nav.prev:not([disabled])').count()) {
  await page.locator('.clearing-nav.prev').click();
  await page.waitForTimeout(220);
}
const after = await plotRects();
const same =
  before.length === after.length &&
  before.every((b) => {
    const a = after.find((x) => x.id === b.id);
    return a && Math.abs(a.left - b.left) <= 1 && Math.abs(a.top - b.top) <= 1;
  });
console.log(`B determinism across reload: ${same} | OK=${same}`);

// C — drag reorders AND both trees move (swap anchors).
{
  const rects = await plotRects();
  const [a, b] = rects;
  const cx = (r) => (r.left + r.right) / 2;
  const cy = (r) => (r.top + r.bottom) / 2;
  await page.mouse.move(cx(a), cy(a));
  await page.mouse.down();
  await page.waitForTimeout(300); // mouse hold beats the 250ms timer
  await page.mouse.move(cx(b), cy(b), { steps: 8 });
  await page.waitForTimeout(250);
  await page.mouse.up();
  await page.waitForTimeout(600);
  const moved = await plotRects();
  const aNow = moved.find((r) => r.id === a.id);
  const swapped = aNow && Math.abs(aNow.left - a.left) > 40;
  console.log(`C drag: "${a.id?.slice(0, 6)}" moved ${Math.abs((aNow?.left ?? 0) - a.left)}px | OK=${!!swapped}`);
}

// D — keyboard nudge still reorders.
{
  const rects = await plotRects();
  const first = rects[0];
  await page.locator(`[data-tree-id="${first.id}"]`).focus();
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(500);
  const now = await plotRects();
  const firstNow = now.find((r) => r.id === first.id);
  const movedK = firstNow && Math.abs(firstNow.left - first.left) > 40;
  console.log(`D keyboard nudge: moved=${!!movedK} | OK=${!!movedK}`);
}

// E — arrows page through disjoint tree sets.
{
  const page1 = new Set((await plotRects()).map((r) => r.id));
  await page.locator('.clearing-nav.next').click();
  await page.waitForTimeout(400);
  const page2 = new Set((await plotRects()).map((r) => r.id));
  const disjoint = [...page2].every((id) => !page1.has(id));
  console.log(`E pagination: page1=${page1.size} page2=${page2.size} disjoint=${disjoint} | OK=${disjoint && page2.size > 0}`);
}

// F — mobile: everything visible fits the viewport and the band.
await page.setViewportSize({ width: 390, height: 844 });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(700);
const mob = await plotRects();
const dotsM = await page.locator('.clearing-dots .dot').count();
const fits = mob.every((r) => r.left >= -6 && r.right <= 396 && r.top > 200);
console.log(`F mobile: visible=${mob.length} dots=${dotsM} all-inside=${fits} | OK=${mob.length === 4 && dotsM === 4 && fits}`);

await browser.close();
console.log('meadow done');
