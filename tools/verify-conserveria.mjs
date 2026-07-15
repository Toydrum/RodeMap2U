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

// E — the seal's «Deshacer» returns the fruits (0.0.90: «abrir» belongs
// to the ceremony now).
await page.locator('.toast button', { hasText: 'Deshacer' }).click();
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

// ── 0.0.90 «el premio del frasco» ──────────────────────────────────────

// L — seal ONE fruit WITH a premio: frasquito vessel + 🎀 ribbon + panel
// chip + the open door. N (inside): the pot never speaks tiers forward.
await page.goto(`${BASE}/cosecha`, { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
await page.locator('.jam-door').click();
await page.waitForTimeout(700);
await page.locator('.fruit-pick').first().click();
await page.waitForTimeout(400);
const potText = ((await page.locator('.jam-sheet').textContent().catch(() => '')) ?? '');
const antiQuota = !/frasquito|frascote|piden|pide un/i.test(potText);
ok('N the pot never computes tiers forward', antiQuota, `"${potText.slice(0, 60).replace(/\s+/g, ' ')}"`);
await page.locator('button', { hasText: 'Al fuego' }).click();
await page.waitForTimeout(300);
await page.locator('button', { hasText: 'Envasar' }).click();
await page.waitForTimeout(400);
const vesselLineL = ((await page.locator('.vessel-line').textContent().catch(() => '')) ?? '').trim();
await page.locator('.premio-field input').fill('ver un capítulo extra');
await page.waitForTimeout(200);
const savedForVisible = await page.locator('.saved-for-field').count();
await page.locator('.seal-btn').click();
await page.waitForTimeout(900);
const jarL = await page.evaluate(async () => {
  const open = indexedDB.open('roadmap2u');
  const db = await new Promise((res, rej) => { open.onsuccess = () => res(open.result); open.onerror = rej; });
  const rows = await new Promise((res, rej) => {
    const req = db.transaction('preserves', 'readonly').objectStore('preserves').getAll();
    req.onsuccess = () => res(req.result);
    req.onerror = rej;
  });
  db.close();
  const live = rows.filter((r) => !r.deletedAt).sort((a, b) => b.madeAt - a.madeAt);
  return live[0] ? { size: live[0].size, premio: live[0].premio, openedAt: live[0].openedAt } : null;
});
const ribbon = await page.locator('.jam-ribbon').count();
ok(
  'L premio seal: frasquito + ribbon + fields',
  vesselLineL.includes('frasquito') && savedForVisible === 1 &&
    jarL?.size === 'frasquito' && jarL?.premio === 'ver un capítulo extra' && !jarL?.openedAt && ribbon >= 1,
  `vessel="${vesselLineL.slice(0, 34)}" size=${jarL?.size} ribbon=${ribbon}`,
);
// Put the SEAL toast away before the ceremony — its protected Deshacer
// (unseal) would otherwise still own the slot when M's Deshacer clicks.
await page.locator('.toast .btn-ghost').click().catch(() => {});
await page.waitForTimeout(300);

// Q — a memory jar (no premio) shows NO open door and never names the absence.
await page.locator('.jam-shelf-jar').last().click(); // oldest = J's memory jar
await page.waitForTimeout(400);
const qPanel = ((await page.locator('.jar-panel').textContent().catch(() => '')) ?? '');
const qOpenBtn = await page.locator('.open-jam-btn').count();
ok('Q memory jar: no open door, absence unnamed', qOpenBtn === 0 && !/sin premio/i.test(qPanel), `btn=${qOpenBtn}`);

// M — the claiming ceremony: openedAt stamps, the rain falls in the jam's
// tint, «Te lo ganaste» speaks, and Deshacer re-closes.
await page.locator('.jam-shelf-jar').first().click(); // newest = L's premio jar
await page.waitForTimeout(400);
const premioChip = await page.locator('.premio-chip').count();
await page.locator('.open-jam-btn').click();
await page.waitForTimeout(600);
await page.locator('.open-it').click();
await page.waitForTimeout(400);
const rainM = await page.locator('.petal-fall').count();
const earned = ((await page.locator('.earned').textContent().catch(() => '')) ?? '');
await page.locator('.enjoy-it').click();
await page.waitForTimeout(500);
const openedStamp = await page.evaluate(async () => {
  const open = indexedDB.open('roadmap2u');
  const db = await new Promise((res, rej) => { open.onsuccess = () => res(open.result); open.onerror = rej; });
  const rows = await new Promise((res, rej) => {
    const req = db.transaction('preserves', 'readonly').objectStore('preserves').getAll();
    req.onsuccess = () => res(req.result);
    req.onerror = rej;
  });
  db.close();
  return rows.find((r) => !r.deletedAt && r.premio === 'ver un capítulo extra')?.openedAt ?? null;
});
await page.locator('.toast button', { hasText: 'Deshacer' }).click();
await page.waitForTimeout(500);
const reclosedStamp = await page.evaluate(async () => {
  const open = indexedDB.open('roadmap2u');
  const db = await new Promise((res, rej) => { open.onsuccess = () => res(open.result); open.onerror = rej; });
  const rows = await new Promise((res, rej) => {
    const req = db.transaction('preserves', 'readonly').objectStore('preserves').getAll();
    req.onsuccess = () => res(req.result);
    req.onerror = rej;
  });
  db.close();
  return rows.find((r) => !r.deletedAt && r.premio === 'ver un capítulo extra')?.openedAt ?? null;
});
ok(
  'M ceremony: rain + Te lo ganaste + stamp + Deshacer re-closes',
  premioChip === 1 && rainM === 1 && earned.includes('Te lo ganaste') &&
    earned.includes('ver un capítulo extra') && !!openedStamp && reclosedStamp === null,
  `rain=${rainM} stamp=${!!openedStamp}→${reclosedStamp}`,
);

// P — reduce-motion ceremony: the words stay (information), the sky steps aside.
await page.emulateMedia({ reducedMotion: 'reduce' });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.locator('.jam-shelf-jar').first().click();
await page.waitForTimeout(400);
await page.locator('.open-jam-btn').click();
await page.waitForTimeout(600);
await page.locator('.open-it').click();
await page.waitForTimeout(400);
const skyHiddenP = await page.evaluate(() => {
  const sky = document.querySelector('.petal-fall');
  return sky ? getComputedStyle(sky).display === 'none' : true;
});
const earnedP = ((await page.locator('.earned').textContent().catch(() => '')) ?? '').includes('Te lo ganaste');
await page.locator('.enjoy-it').click();
await page.waitForTimeout(400);
const disfrutada = ((await page.locator('.enjoyed-line').textContent().catch(() => '')) ?? '').trim();
ok('P reduce-motion: words stay, sky aside, jar disfrutada', skyHiddenP && earnedP && disfrutada.length > 0, `"${disfrutada.slice(0, 26)}"`);
await page.emulateMedia({ reducedMotion: null });

// O — six fruits make a frascote («una mermelada poderosa»).
await page.evaluate(async () => {
  const open = indexedDB.open('roadmap2u');
  const db = await new Promise((res, rej) => { open.onsuccess = () => res(open.result); open.onerror = rej; });
  const accents = ['moss', 'sage', 'sky', 'clay', 'lavender', 'sand'];
  await new Promise((res, rej) => {
    const tx = db.transaction('harvests', 'readwrite');
    const os = tx.objectStore('harvests');
    const now = Date.now();
    for (let i = 0; i < 6; i++) {
      os.put({
        id: 'h:probe-o-' + i, createdAt: now, updatedAt: now, rev: 1, deletedAt: null,
        nodeId: 'probe-o-' + i, treeId: 'probe-tree', treeName: 'Sonda', accent: accents[i],
        title: 'Logro ' + (i + 1), harvestedAt: now - i * 1000, preserveId: null,
      });
    }
    tx.oncomplete = () => res();
    tx.onerror = rej;
  });
  db.close();
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.locator('.jam-door').click();
await page.waitForTimeout(700);
for (let i = 0; i < 6; i++) {
  await page.locator('.fruit-pick').nth(i).click();
  await page.waitForTimeout(120);
}
await page.locator('button', { hasText: 'Al fuego' }).click();
await page.waitForTimeout(300);
await page.locator('button', { hasText: 'Envasar' }).click();
await page.waitForTimeout(400);
const vesselLineO = ((await page.locator('.vessel-line').textContent().catch(() => '')) ?? '').trim();
await page.locator('.seal-btn').click();
await page.waitForTimeout(900);
const sizeO = await page.evaluate(async () => {
  const open = indexedDB.open('roadmap2u');
  const db = await new Promise((res, rej) => { open.onsuccess = () => res(open.result); open.onerror = rej; });
  const rows = await new Promise((res, rej) => {
    const req = db.transaction('preserves', 'readonly').objectStore('preserves').getAll();
    req.onsuccess = () => res(req.result);
    req.onerror = rej;
  });
  db.close();
  return rows.filter((r) => !r.deletedAt).sort((a, b) => b.madeAt - a.madeAt)[0]?.size ?? null;
});
ok('O six fruits = frascote poderosa', vesselLineO.includes('poderosa') && sizeO === 'frascote', `"${vesselLineO.slice(0, 44)}" size=${sizeO}`);

// R — «segunda cosecha» (0.0.91): a sealed fruit is never re-offered in
// the pot; re-achieving its branch leaves the jam UNTOUCHED (immutable
// history) and mints a NEW season fruit into the fresh jar.
const jammed = await page.evaluate(async () => {
  const open = indexedDB.open('roadmap2u');
  const db = await new Promise((res, rej) => { open.onsuccess = () => res(open.result); open.onerror = rej; });
  const read = (s) =>
    new Promise((res, rej) => {
      const req = db.transaction(s, 'readonly').objectStore(s).getAll();
      req.onsuccess = () => res(req.result);
      req.onerror = rej;
    });
  const rows = await read('harvests');
  const nodes = await read('nodes');
  db.close();
  const byId = new Map(nodes.map((n) => [n.id, n]));
  // §B senderoized a demo parent mid-probe — its pasitos (correctly) bear
  // no fruit, so R must pick a jammed fruit whose branch still mints.
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
  const row = rows.find((r) => {
    if (r.deletedAt || !r.preserveId || r.nodeId.startsWith('probe-')) return false;
    const node = byId.get(r.nodeId);
    return !!node && !node.deletedAt && !node.archivedAt && !node.repeatsDaily && !underDaily(node);
  });
  return row
    ? { id: row.id, nodeId: row.nodeId, treeId: row.treeId, title: row.title, harvestedAt: row.harvestedAt, preserveId: row.preserveId }
    : null;
});
ok('R0 a real jammed fruit exists', !!jammed, jammed?.title ?? 'none');
await page.goto(`${BASE}/cosecha`, { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
await page.locator('.jam-door').click();
await page.waitForTimeout(700);
const trayBefore = (await page.locator('.fruit-pick .pick-title').allTextContents()).map((t) => t.trim());
const excluded = !trayBefore.includes(jammed.title);
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
ok('R1 the pot never re-offers a sealed fruit', excluded, `tray=${trayBefore.length}`);

await page.goto(`${BASE}/tree/${jammed.treeId}?node=${jammed.nodeId}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.locator('.status-row .chip.pick', { hasText: 'Creciendo' }).click();
await page.waitForTimeout(600);
await page.locator('.status-row .chip.pick', { hasText: 'Florecida' }).click();
await page.waitForTimeout(800);
const seasons = await page.evaluate(async (info) => {
  const open = indexedDB.open('roadmap2u');
  const db = await new Promise((res, rej) => { open.onsuccess = () => res(open.result); open.onerror = rej; });
  const rows = await new Promise((res, rej) => {
    const req = db.transaction('harvests', 'readonly').objectStore('harvests').getAll();
    req.onsuccess = () => res(req.result);
    req.onerror = rej;
  });
  db.close();
  const original = rows.find((r) => r.id === info.id);
  const fresh = rows.filter((r) => !r.deletedAt && r.nodeId === info.nodeId && !r.preserveId);
  return {
    jamUntouched: original.preserveId === info.preserveId && original.harvestedAt === info.harvestedAt,
    freshSeasons: fresh.length,
    seasonId: fresh[0]?.id ?? '',
  };
}, jammed);
await page.goto(`${BASE}/cosecha`, { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
await page.locator('.jam-door').click();
await page.waitForTimeout(700);
const trayAfter = (await page.locator('.fruit-pick .pick-title').allTextContents()).map((t) => t.trim());
const offeredAgain = trayAfter.includes(jammed.title);
ok(
  'R2 re-achieve: jam immutable + a NEW season fruit is usable',
  seasons.jamUntouched && seasons.freshSeasons === 1 && seasons.seasonId.includes(':s') && offeredAgain,
  `jamUntouched=${seasons.jamUntouched} season=${seasons.seasonId.slice(-10)} offered=${offeredAgain}`,
);

console.log('conserveria done');
await browser.close();
