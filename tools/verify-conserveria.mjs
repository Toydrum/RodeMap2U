// «La conservería» (0.0.89). A: a real bloom plays the HARVEST layer —
// full-screen petal fall + the earned-fruit card — beside the act burst.
// B: an almanaque sendero stone celebrates the ACT only (no sky, no card
// — the sky never lies). C: reduce-motion keeps the card (information),
// drops the sky. D: the seal ritual moves fruits' HOME, register intact,
// lifetime count UNCHANGED (nada se gasta). E: «Abrir el frasco» undoes.
// F: one fruit is a whole batch. G: a mixed pot derives «del bosque».
// H: the edited name persists to the shelf + register chip. I: a tea
// leaves NO residue anywhere. J: the mesita renders jars and the meadow
// plot centers stay self-resolving. K: DOORS CANCEL — dismissing the
// ritual mid-way changes nothing.
import { BASE, launchPage, ok } from './lib/harness.mjs';

const { browser, page } = await launchPage();

const idbCounts = () =>
  page.evaluate(async () => {
    const open = indexedDB.open('roadmap2u');
    const db = await new Promise((res, rej) => {
      open.onsuccess = () => res(open.result);
      open.onerror = rej;
    });
    const read = (store) =>
      new Promise((res, rej) => {
        const req = db.transaction(store, 'readonly').objectStore(store).getAll();
        req.onsuccess = () => res(req.result);
        req.onerror = rej;
      });
    const harvests = await read('harvests');
    const preserves = await read('preserves');
    db.close();
    return {
      harvests: harvests.filter((r) => !r.deletedAt).length,
      preserved: harvests.filter((r) => !r.deletedAt && r.preserveId).length,
      jars: preserves.filter((r) => !r.deletedAt).length,
      jarNames: preserves.filter((r) => !r.deletedAt).map((r) => r.name),
    };
  });

await page.goto(`${BASE}/forest?seed=demo`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1100);

// A — bloom a fresh branch → sky (14 petals) + fruit card + toast.
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
  const pick = rows.find(
    (r) =>
      !r.deletedAt && !r.archivedAt && !r.repeatsDaily &&
      (r.status === 'seed' || r.status === 'growing'),
  );
  return { treeId: pick.treeId, nodeId: pick.id };
});
await page.goto(`${BASE}/tree/${siteA.treeId}?node=${siteA.nodeId}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.locator('.status-row .chip.pick', { hasText: 'Florecida' }).click();
await page.waitForTimeout(350);
const petals = await page.locator('.petal-fall .fall-petal').count();
const card = await page.locator('.fruit-card').count();
const cardText = ((await page.locator('.fruit-card').textContent().catch(() => '')) ?? '').trim();
const burstA = await page.locator('.bloom-burst').count();
await page.waitForTimeout(3000);
const skyGone = (await page.locator('.petal-fall').count()) === 0;
const cardGone = (await page.locator('.fruit-card').count()) === 0;
ok(
  'A mint: sky (14) + card + burst, both breathe out',
  petals === 14 && card === 1 && cardText.length > 0 && burstA >= 1 && skyGone && cardGone,
  `petals=${petals} card=${card} "${cardText.slice(0, 26)}"`,
);

// B — sendero stone: act burst only, never the harvest layer.
await page.evaluate(async () => {
  const open = indexedDB.open('roadmap2u');
  const db = await new Promise((res, rej) => {
    open.onsuccess = () => res(open.result);
    open.onerror = rej;
  });
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
await page.goto(`${BASE}/almanaque`, { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
await page.locator('.alm-stone.next').click();
await page.waitForTimeout(300);
const burstB = await page.locator('.bloom-burst').count();
const skyB = await page.locator('.petal-fall').count();
const cardB = await page.locator('.fruit-card').count();
ok('B stone: burst yes, sky/card never', burstB >= 1 && skyB === 0 && cardB === 0, `burst=${burstB} sky=${skyB} card=${cardB}`);

// D + F + H — the seal ritual: ONE fruit is a whole batch, the name is
// editable, the register keeps every fruit and the count never moves.
const before = await idbCounts();
await page.goto(`${BASE}/cosecha`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.locator('.jam-door').click();
await page.waitForTimeout(700);
await page.locator('.fruit-pick').first().click();
await page.waitForTimeout(600);
const potCount = await page.locator('.pot-fruit').count();
await page.locator('button', { hasText: 'Al fuego' }).click();
await page.waitForTimeout(400);
await page.locator('button', { hasText: 'Remover' }).click();
await page.waitForTimeout(300);
await page.locator('button', { hasText: 'Envasar' }).click();
await page.waitForTimeout(400);
await page.locator('#jam-name').fill('La mermelada de mis exámenes');
await page.locator('.seal-btn').click();
await page.waitForTimeout(900);
const after = await idbCounts();
const shelfJars = await page.locator('.jam-shelf-jar').count();
const shelfName = ((await page.locator('.jam-name').first().textContent().catch(() => '')) ?? '').trim();
ok(
  'D/F/H seal: one-fruit batch, home moves, register intact, name kept',
  potCount === 1 &&
    after.jars === before.jars + 1 &&
    after.preserved === before.preserved + 1 &&
    after.harvests === before.harvests &&
    shelfJars >= 1 &&
    shelfName === 'La mermelada de mis exámenes',
  `jars=${before.jars}→${after.jars} fruits=${before.harvests}→${after.harvests} name="${shelfName.slice(0, 22)}"`,
);
const totalLine = ((await page.locator('.total-line').textContent().catch(() => '')) ?? '').trim();
ok('D2 lifetime count counts the register', totalLine.includes(String(after.harvests)), `"${totalLine}"`);

// register chip: the jammed fruit says where it lives now
const chip = await page.locator('.jar-chip').count();
ok('D3 register shows the single-home chip', chip >= 1, `chips=${chip}`);

// E — «Abrir el frasco» returns the fruits.
await page.locator('.toast button', { hasText: 'Abrir el frasco' }).click();
await page.waitForTimeout(700);
const undone = await idbCounts();
ok(
  'E undo returns the fruit to the fresh jar',
  undone.jars === before.jars && undone.preserved === before.preserved && undone.harvests === before.harvests,
  `jars=${undone.jars} preserved=${undone.preserved}`,
);

// G — a mixed pot derives «del bosque» (two different-accent fruits).
const freshSpecies = await page.evaluate(async () => {
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
  return [...new Set(rows.filter((r) => !r.deletedAt && !r.preserveId).map((r) => r.accent))].length;
});
if (freshSpecies >= 2) {
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  await page.locator('.jam-door').click();
  await page.waitForTimeout(700);
  // pick two fruits of DIFFERENT accents via their order in the tray —
  // tray is newest-first; find indices by evaluating the accents.
  const picks = await page.evaluate(async () => {
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
    const fresh = rows
      .filter((r) => !r.deletedAt && !r.preserveId)
      .sort((a, b) => b.harvestedAt - a.harvestedAt || (a.id < b.id ? -1 : 1));
    const first = 0;
    const second = fresh.findIndex((r) => r.accent !== fresh[0].accent);
    return { first, second };
  });
  await page.locator('.fruit-pick').nth(picks.first).click();
  await page.locator('.fruit-pick').nth(picks.second).click();
  await page.waitForTimeout(400);
  const tag = ((await page.locator('.pot-tag').textContent().catch(() => '')) ?? '').trim();
  ok('G mixed pot derives del bosque', tag.includes('bosque'), `"${tag}"`);
  // K — DOORS CANCEL: dismiss mid-ritual, nothing changes.
  const preK = await idbCounts();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  const postK = await idbCounts();
  const sheetGone = (await page.locator('.jam-sheet').count()) === 0;
  ok(
    'K doors cancel: dismissing the pot changes nothing',
    sheetGone && postK.jars === preK.jars && postK.preserved === preK.preserved,
    `jars=${postK.jars} preserved=${postK.preserved}`,
  );
} else {
  ok('G mixed pot derives del bosque', false, `only ${freshSpecies} species fresh in demo`);
}

// I — a tea leaves NO residue.
const preTea = await idbCounts();
await page.locator('.tea-door').click();
await page.waitForTimeout(700);
await page.locator('button', { hasText: 'Que me sorprenda' }).click();
await page.waitForTimeout(300);
await page.locator('.tea-brew').click();
await page.waitForTimeout(500);
let sips = 0;
while ((await page.locator('.tea-sip').count()) && sips < 5) {
  await page.locator('.tea-sip').click();
  await page.waitForTimeout(250);
  sips++;
}
await page.locator('.tea-end').click();
await page.waitForTimeout(400);
const postTea = await idbCounts();
ok(
  'I tea leaves no residue',
  postTea.jars === preTea.jars && postTea.preserved === preTea.preserved && postTea.harvests === preTea.harvests,
  `sips=${sips + 1}`,
);

// C — reduce-motion: the card (information) stays, the sky steps aside.
await page.emulateMedia({ reducedMotion: 'reduce' });
const siteC = await page.evaluate(async () => {
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
      !r.deletedAt && !r.archivedAt && !r.repeatsDaily &&
      (r.status === 'seed' || r.status === 'growing') && !underDaily(r),
  );
  return { treeId: pick.treeId, nodeId: pick.id };
});
await page.goto(`${BASE}/tree/${siteC.treeId}?node=${siteC.nodeId}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.locator('.status-row .chip.pick', { hasText: 'Florecida' }).click();
await page.waitForTimeout(350);
const cardRM = await page.locator('.fruit-card').count();
const skyHidden = await page.evaluate(() => {
  const sky = document.querySelector('.petal-fall');
  return sky ? getComputedStyle(sky).display === 'none' : true;
});
ok('C reduce-motion: card stays, sky steps aside', cardRM === 1 && skyHidden, `card=${cardRM} skyHidden=${skyHidden}`);

// J — the mesita: seal a real jar, then the meadow shows it and every plot
// center still resolves to itself (the anchor law).
await page.emulateMedia({ reducedMotion: null });
await page.goto(`${BASE}/cosecha`, { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
await page.locator('.jam-door').click();
await page.waitForTimeout(700);
await page.locator('.fruit-pick').first().click();
await page.locator('button', { hasText: 'Al fuego' }).click();
await page.waitForTimeout(300);
await page.locator('button', { hasText: 'Envasar' }).click();
await page.waitForTimeout(300);
await page.locator('.seal-btn').click();
await page.waitForTimeout(900);
await page.goto(`${BASE}/forest`, { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
const mesitaJams = await page.locator('.meadow-jar app-jam-jar').count();
const centersOk = await page.evaluate(() =>
  [...document.querySelectorAll('.plot')].every((p) => {
    const r = p.getBoundingClientRect();
    const el = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2);
    return el?.closest('[data-tree-id]') === p;
  }),
);
ok('J mesita shows the jam + plot centers hold', mesitaJams >= 1 && centersOk, `jams=${mesitaJams} centers=${centersOk}`);

console.log('conserveria done');
await browser.close();
