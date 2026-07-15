import { AccentToken, Harvest, JarVessel, Preserve, TreeNode } from './db/schema';
import { dayOf } from './time';

/**
 * «La cosecha» — the PURE harvest brain (0.0.88). Sister of suggest.ts:
 * no Angular, fully vitest-able. It holds THE sendero law in one place
 * (the almanaque's step exclusion and the fruit-minting guard must never
 * disagree) and arranges harvests into months for the pantry page.
 *
 * The law, doctrine-grade: every achieved branch bears one fruit — except
 * the pasitos of a sendero. Los pasitos del caminito no dan fruta; el
 * sendero entero, sí. (A durable fruit minted daily by a routine is a
 * day-counter wearing a costume; the caminito is already their celebration.)
 */

/** A live sendero parent — its steps reset each morning and leave no
 *  history anywhere (month marks, fruit). A BRANCHED former sendero stops
 *  qualifying: its branch-born alternatives are ordinary branches. */
export function isDailyPathParent(node: TreeNode): boolean {
  return !!node.repeatsDaily && node.flow === 'steps' && node.status !== 'branched';
}

/** True when any ANCESTOR is a live sendero parent — the node is a pasito
 *  (or a sub-pasito) of a daily path. The sendero parent itself is NOT
 *  under a daily path: retiring the whole sendero bears fruit with honor. */
export function underDailyPath(
  node: TreeNode,
  byId: ReadonlyMap<string, TreeNode>,
): boolean {
  const seen = new Set<string>();
  let current: TreeNode | undefined = node;
  while (current?.parentId && !seen.has(current.parentId)) {
    seen.add(current.parentId);
    const parent = byId.get(current.parentId);
    if (!parent) return false;
    if (isDailyPathParent(parent)) return true;
    current = parent;
  }
  return false;
}

/** «La conservería» (0.0.89): fresh = still in the harvest jar. The
 *  single-home law — a fruit lives in exactly ONE place. */
export function isFresh(h: Harvest): boolean {
  return !h.preserveId;
}

/** A sealed jar's member fruits, newest first (the disclosure panel's
 *  order — same tiebreak as everywhere). */
export function membersOf(preserveId: string, rows: Harvest[]): Harvest[] {
  return rows
    .filter((h) => h.preserveId === preserveId)
    .sort((a, b) => b.harvestedAt - a.harvestedAt || (a.id < b.id ? -1 : 1));
}

/** The batch's flavor: one species → its accent; mixed → null =
 *  «mermelada del bosque» (first-class, never a fallback). */
export function deriveAccent(members: Harvest[]): AccentToken | null {
  const accents = new Set(members.map((m) => m.accent));
  return accents.size === 1 ? members[0].accent : null;
}

/** THE one vessel-threshold law (0.0.90 — «el frasco sirve a la fruta»):
 *  1–2 frutas → frasquito · 3–5 → frasco · 6+ → frascote. Published in the
 *  guide, NEVER computed forward on a working surface (no pot counters). */
export function jarSizeFor(count: number): JarVessel {
  if (count <= 2) return 'frasquito';
  if (count <= 5) return 'frasco';
  return 'frascote';
}

/** «La promesa» (0.0.93) — a goal jar's capacity: the TOP of each published
 *  jarSizeFor band (frasquito 2 · frasco 5 · frascote 8). By construction a
 *  full goal jar (N = jarCapacity(size)) satisfies jarSizeFor(N) === size, so
 *  a filled+auto-sealed promise is indistinguishable at rest from a pot jam of
 *  the same vessel. Published in the guide; the ONLY forward-facing count line
 *  («lleva n · le caben cap») lives solely on the pending jar's detail panel. */
export function jarCapacity(v: JarVessel): number {
  return v === 'frasquito' ? 2 : v === 'frasco' ? 5 : 8;
}

/** A goal jar (born empty at the wizard) vs an ordinary pot jam. */
export function isPromise(p: Preserve): boolean {
  return p.plannedAt != null;
}

/** A goal jar still filling — the only jar family that is NOT immutable
 *  history (its member fruits re-stamp in place; only a SEALED jar is final).
 *  Assumes a live record (repos already filter tombstones). */
export function isPending(p: Preserve): boolean {
  return isPromise(p) && !p.sealedAt;
}

/** A finished jam belonging on the alacena: a legacy pot jam (plannedAt
 *  absent) or a sealed promise. Everything that is NOT a pending goal jar. */
export function isSealedJam(p: Preserve): boolean {
  return !isPending(p);
}

/** One shelf section of the pantry: a month and its fruits. */
export interface HarvestMonth {
  /** 'YYYY-MM' local month of harvestedAt. */
  key: string;
  items: Harvest[];
}

/** Months freshest-first; within a month, newest fruit first. Grouping
 *  only — never a count per month, never a comparison between months. */
export function harvestMonths(rows: Harvest[]): HarvestMonth[] {
  const byMonth = new Map<string, Harvest[]>();
  for (const row of rows) {
    const key = dayOf(row.harvestedAt).slice(0, 7);
    byMonth.set(key, [...(byMonth.get(key) ?? []), row]);
  }
  return [...byMonth.entries()]
    .sort((a, b) => (a[0] > b[0] ? -1 : 1))
    .map(([key, items]) => ({
      key,
      items: items.sort((a, b) => b.harvestedAt - a.harvestedAt || (a.id < b.id ? -1 : 1)),
    }));
}
