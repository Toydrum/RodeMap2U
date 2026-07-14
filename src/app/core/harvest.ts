import { Harvest, TreeNode } from './db/schema';
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
