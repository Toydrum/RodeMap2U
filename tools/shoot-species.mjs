// Species silhouette battery (0.0.43): one ~11-node tree per form
// (oak=moss · acacia=clay · slender=sky), a steps chain, a baby, the demo
// forest minis. Screenshots for self-review against Hector's references.
import { chromium } from 'playwright-core';
const BASE = 'http://localhost:' + (process.env.RM_PORT ?? '8826');
const OUT = process.argv[2] ?? '.';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1100, height: 780 } });

async function centers(p) {
  return p.evaluate(() => {
    const svg = document.querySelector('svg.canvas');
    const rect = svg.getBoundingClientRect();
    const t = (svg.querySelector(':scope > g').getAttribute('transform') ?? '').match(
      /translate\(([-\d.]+)\s+([-\d.]+)\)\s+scale\(([-\d.]+)\)/,
    );
    const [tx, ty, k] = t ? [Number(t[1]), Number(t[2]), Number(t[3])] : [0, 0, 1];
    return [...svg.querySelectorAll('g.node')].map((g) => {
      const nm = (g.getAttribute('transform') ?? '').match(/translate\(([-\d.]+)\s+([-\d.]+)\)/);
      return {
        label: (g.getAttribute('aria-label') ?? '').split(' — ')[0],
        x: rect.left + Number(nm[1]) * k + tx,
        y: rect.top + Number(nm[2]) * k + ty,
      };
    });
  });
}

await page.goto(`${BASE}/check-in`, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await page.locator('button', { hasText: 'Empezar' }).click();
await page.waitForTimeout(250);
await page.locator('.skip').click();
await page.waitForURL('**/ahora**');
await page.locator('nav a', { hasText: 'bosque' }).click();
await page.waitForTimeout(400);

async function plantTree(name, accent) {
  const opener = (await page.locator('button:has-text("Plantar mi primer árbol")').count())
    ? 'Plantar mi primer árbol'
    : 'Plantar un árbol';
  await page.locator(`button:has-text("${opener}")`).first().click();
  await page.fill('#tree-name', name);
  await page.locator(`.accent[aria-label="${accent}"]`).click();
  await page.locator('form.sheet button[type=submit]').click();
  await page.waitForTimeout(300);
}

async function findVisible(label) {
  const seek = (all) => all.find((n) => n.label === label || n.label.startsWith(label + ' '));
  let target = seek(await centers(page));
  if (!target) throw new Error(`node not found: ${label}`);
  // Planting pans to the newborn — the target may sit off-screen. Refit first.
  if (target.x < 24 || target.x > 1076 || target.y < 110 || target.y > 720) {
    await page.locator('.center-btn').click();
    await page.waitForTimeout(500);
    target = seek(await centers(page));
  }
  return target;
}

async function addUnder(label, titles) {
  const target = await findVisible(label);
  await page.mouse.click(target.x, target.y);
  await page.waitForTimeout(420);
  for (const t of titles) {
    const input = page.locator('input[placeholder*="pasito"]');
    await input.fill(t);
    await input.press('Enter');
    await page.waitForTimeout(160);
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(280);
}

async function bloomFirst(label, count) {
  const target = await findVisible(label);
  await page.mouse.click(target.x, target.y);
  await page.waitForTimeout(420);
  for (let i = 0; i < count; i++) {
    await page.locator('.steps li button', { hasText: '🌸' }).first().click();
    await page.waitForTimeout(250);
    await page.locator('.toast .btn-ghost').click().catch(() => {});
    await page.waitForTimeout(150);
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(280);
}

const SPECIES = [
  { name: 'Roble', accent: 'moss' },
  { name: 'Acacia', accent: 'clay' },
  { name: 'Esbelto', accent: 'sky' },
];
for (const sp of SPECIES) {
  await page.locator('nav a', { hasText: 'bosque' }).click();
  await page.waitForTimeout(400);
  await plantTree(sp.name, sp.accent);
  while (await page.locator('.clearing-nav.next:not([disabled])').count()) {
    await page.locator('.clearing-nav.next').click();
    await page.waitForTimeout(220);
  }
  await page.locator(`.plot:has-text("${sp.name}")`).click();
  await page.waitForTimeout(700);
  await addUnder(sp.name, ['Aprender', 'Practicar', 'Compartir']);
  await addUnder('Aprender', ['Lo básico', 'Un curso']);
  await addUnder('Practicar', ['Diario 10 min', 'Con amigos', 'Un reto']);
  await addUnder('Compartir', ['Primer público']);
  await bloomFirst('Aprender', 1);
  await page.locator('.center-btn').click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/species-${sp.accent}.png` });
  console.log(`shot species-${sp.accent} (${sp.name})`);
}

// Steps chain on the slender tree
const target = await findVisible('Compartir');
await page.mouse.click(target.x, target.y);
await page.waitForTimeout(400);
for (const t of ['Elegir tema', 'Ensayar', 'Grabar']) {
  const input = page.locator('input[placeholder*="pasito"]');
  await input.fill(t);
  await input.press('Enter');
  await page.waitForTimeout(160);
}
await page.locator('.order-toggle input').check();
await page.waitForTimeout(250);
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
await page.locator('.center-btn').click();
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/species-chain.png` });
console.log('shot species-chain');

// Forest minis (three species side by side) + demo forest
await page.locator('nav a', { hasText: 'bosque' }).click();
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/species-forest.png` });
console.log('shot species-forest');

const page2 = await browser.newPage({ viewport: { width: 1100, height: 780 } });
await page2.goto(`${BASE}/tree/demo-guitar?seed=demo`, { waitUntil: 'networkidle' });
await page2.waitForTimeout(900);
await page2.screenshot({ path: `${OUT}/species-demo-guitar.png` });
await page2.goto(`${BASE}/forest`, { waitUntil: 'networkidle' });
await page2.waitForTimeout(700);
await page2.screenshot({ path: `${OUT}/species-demo-forest.png` });
console.log('shot demo');
await browser.close();
console.log('species shots done');
