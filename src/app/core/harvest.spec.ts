import { describe, expect, it } from 'vitest';
import { Harvest, TreeNode } from './db/schema';
import { harvestMonths, isDailyPathParent, underDailyPath } from './harvest';

function node(id: string, extra: Partial<TreeNode> = {}): TreeNode {
  return {
    id,
    createdAt: 0,
    updatedAt: 0,
    rev: 1,
    deletedAt: null,
    treeId: 't1',
    parentId: null,
    title: id,
    note: '',
    status: 'growing',
    order: 10,
    targetDate: null,
    achievedAt: null,
    branchedAt: null,
    origin: 'planned',
    archivedAt: null,
    trigger: null,
    ...extra,
  };
}

function harvest(id: string, harvestedAt: number): Harvest {
  return {
    id: 'h:' + id,
    createdAt: harvestedAt,
    updatedAt: harvestedAt,
    rev: 1,
    deletedAt: null,
    nodeId: id,
    treeId: 't1',
    treeName: 'Árbol',
    accent: 'moss',
    title: id,
    harvestedAt,
  };
}

/** Local epoch-ms noon for a date key — mirrors dayOf's local math. */
function noonOf(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, 12).getTime();
}

const byId = (nodes: TreeNode[]) => new Map(nodes.map((n) => [n.id, n]));

describe('isDailyPathParent — THE sendero law, single home', () => {
  it('holds only for live repeatsDaily steps parents', () => {
    expect(isDailyPathParent(node('s', { repeatsDaily: true, flow: 'steps' }))).toBe(true);
    expect(isDailyPathParent(node('s', { repeatsDaily: true, flow: 'steps', status: 'resting' }))).toBe(true);
    expect(isDailyPathParent(node('s', { flow: 'steps' }))).toBe(false);
    expect(isDailyPathParent(node('s', { repeatsDaily: true }))).toBe(false);
  });

  it('a BRANCHED former sendero stops qualifying (its alternatives are ordinary branches)', () => {
    expect(
      isDailyPathParent(node('s', { repeatsDaily: true, flow: 'steps', status: 'branched' })),
    ).toBe(false);
  });
});

describe('underDailyPath — pasitos (and sub-pasitos) bear no fruit', () => {
  const sendero = node('camino', { repeatsDaily: true, flow: 'steps' });
  const step = node('paso', { parentId: 'camino' });
  const subStep = node('sub', { parentId: 'paso' });

  it('finds the sendero at any ancestor depth', () => {
    const map = byId([sendero, step, subStep]);
    expect(underDailyPath(step, map)).toBe(true);
    expect(underDailyPath(subStep, map)).toBe(true);
  });

  it('the sendero parent itself is NOT under a daily path (retiring it bears fruit)', () => {
    expect(underDailyPath(sendero, byId([sendero, step]))).toBe(false);
  });

  it('ordinary branches and children of a BRANCHED former sendero walk free', () => {
    const branched = node('bp', { repeatsDaily: true, flow: 'steps', status: 'branched' });
    const alt = node('alt', { parentId: 'bp' });
    expect(underDailyPath(node('root'), byId([]))).toBe(false);
    expect(underDailyPath(alt, byId([branched, alt]))).toBe(false);
  });

  it('a missing parent or a parent cycle never hangs and never lies', () => {
    const orphan = node('o', { parentId: 'gone' });
    expect(underDailyPath(orphan, byId([orphan]))).toBe(false);
    const a = node('a', { parentId: 'b' });
    const b = node('b', { parentId: 'a' });
    expect(underDailyPath(a, byId([a, b]))).toBe(false);
  });
});

describe('harvestMonths — shelves, never comparisons', () => {
  it('groups by local month, freshest month first, newest fruit first within', () => {
    const rows = [
      harvest('june-early', noonOf('2026-06-03')),
      harvest('july-late', noonOf('2026-07-20')),
      harvest('july-early', noonOf('2026-07-02')),
      harvest('june-late', noonOf('2026-06-28')),
    ];
    const months = harvestMonths(rows);
    expect(months.map((m) => m.key)).toEqual(['2026-07', '2026-06']);
    expect(months[0].items.map((h) => h.nodeId)).toEqual(['july-late', 'july-early']);
    expect(months[1].items.map((h) => h.nodeId)).toEqual(['june-late', 'june-early']);
  });

  it('is empty on an empty pantry and stable on same-instant ties', () => {
    expect(harvestMonths([])).toEqual([]);
    const t = noonOf('2026-07-10');
    const months = harvestMonths([harvest('b', t), harvest('a', t)]);
    expect(months[0].items.map((h) => h.nodeId)).toEqual(['a', 'b']);
  });
});
