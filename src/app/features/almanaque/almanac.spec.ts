import { describe, expect, it } from 'vitest';
import { CheckIn, Tree, TreeNode } from '../../core/db/schema';
import { caminitos, marksFor, monthMatrix, upcoming, whenWord } from './almanac';

function tree(id: string, name = id): Tree {
  return {
    id,
    createdAt: 0,
    updatedAt: 0,
    rev: 1,
    deletedAt: null,
    name,
    accent: 'moss',
    order: 10,
    currentNodeId: null,
    archivedAt: null,
  };
}

function node(id: string, treeId: string, extra: Partial<TreeNode> = {}): TreeNode {
  return {
    id,
    createdAt: 0,
    updatedAt: 0,
    rev: 1,
    deletedAt: null,
    treeId,
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

function checkin(id: string, createdAt: number): CheckIn {
  return {
    id,
    createdAt,
    updatedAt: createdAt,
    rev: 1,
    deletedAt: null,
    feeling: 'calm',
    note: '',
    treeId: null,
    nodeId: null,
  };
}

/** Local epoch-ms noon for a date key — mirrors dayOf's local math. */
function noonOf(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, 12).getTime();
}

const byTree = (trees: Tree[], nodes: TreeNode[]) => {
  const map = new Map<string, TreeNode[]>();
  for (const t of trees) map.set(t.id, nodes.filter((n) => n.treeId === t.id));
  return map;
};

const TODAY = '2026-07-15';

describe('monthMatrix', () => {
  it('pads to full weeks, Monday-first — July 2026 starts on a Wednesday', () => {
    const weeks = monthMatrix(2026, 7, 1);
    expect(weeks[0]).toHaveLength(7);
    // 2026-07-01 is a Wednesday: two leading June days (Mon 29, Tue 30).
    expect(weeks[0][0]).toEqual({ date: '2026-06-29', inMonth: false });
    expect(weeks[0][2]).toEqual({ date: '2026-07-01', inMonth: true });
    const flat = weeks.flat();
    expect(flat.filter((c) => c.inMonth)).toHaveLength(31);
    expect(flat.length % 7).toBe(0);
  });

  it('handles February and the year wrap', () => {
    const feb = monthMatrix(2027, 2, 1).flat().filter((c) => c.inMonth);
    expect(feb).toHaveLength(28);
    const dec = monthMatrix(2026, 12, 1).flat();
    expect(dec.some((c) => c.date.startsWith('2027-01') && !c.inMonth)).toBe(true);
    const jan = monthMatrix(2026, 1, 1).flat();
    expect(jan.some((c) => c.date.startsWith('2025-12') && !c.inMonth)).toBe(true);
  });

  it('Sunday-first shifts the lead', () => {
    const weeks = monthMatrix(2026, 7, 0);
    // Sunday-first: July 1 (Wednesday) sits at index 3.
    expect(weeks[0][3]).toEqual({ date: '2026-07-01', inMonth: true });
  });
});

describe('marksFor — the golden rule', () => {
  it('future capullo on its day; passed-unresolved stays on ITS day wearing passed=true', () => {
    const t = tree('t1');
    const nodes = [
      node('future', 't1', { targetDate: '2026-07-20' }),
      node('missed', 't1', { targetDate: '2026-07-10' }),
    ];
    const marks = marksFor([t], byTree([t], nodes), [], TODAY);
    expect(marks.get('2026-07-20')!.capullos[0]).toMatchObject({ passed: false });
    expect(marks.get('2026-07-10')!.capullos[0]).toMatchObject({ passed: true });
  });

  it('flowers on the achievedAt day, knots on the branchedAt day', () => {
    const t = tree('t1');
    const nodes = [
      node('bloomed', 't1', { status: 'achieved', achievedAt: noonOf('2026-07-03') }),
      node('knotted', 't1', { status: 'branched', branchedAt: noonOf('2026-07-08') }),
    ];
    const marks = marksFor([t], byTree([t], nodes), [], TODAY);
    expect(marks.get('2026-07-03')!.flowers).toHaveLength(1);
    expect(marks.get('2026-07-08')!.knots).toHaveLength(1);
    // achieved/branched never render a capullo even if a date lingers
    expect(marks.get('2026-07-03')!.capullos).toHaveLength(0);
  });

  it('sendero steps leave NO month marks (their history vanishes by design)', () => {
    const t = tree('t1');
    const parent = node('camino', 't1', { flow: 'steps', repeatsDaily: true });
    const step = node('paso', 't1', {
      parentId: 'camino',
      status: 'achieved',
      achievedAt: noonOf('2026-07-14'),
      targetDate: '2026-07-20',
    });
    const marks = marksFor([t], byTree([t], [parent, step]), [], TODAY);
    expect(marks.get('2026-07-14')?.flowers ?? []).toHaveLength(0);
    expect(marks.get('2026-07-20')?.capullos ?? []).toHaveLength(0);
  });

  it('check-ins mark presence only', () => {
    const t = tree('t1');
    const marks = marksFor([t], byTree([t], []), [checkin('c1', noonOf('2026-07-05'))], TODAY);
    expect(marks.get('2026-07-05')!.hasCheckin).toBe(true);
    expect(marks.get('2026-07-05')!.flowers).toHaveLength(0);
  });
});

describe('upcoming — soft words, never numbers', () => {
  it('caps at 3, soonest first, and words the distance', () => {
    const t = tree('t1');
    const nodes = [
      node('a', 't1', { targetDate: '2026-07-16' }),
      node('b', 't1', { targetDate: '2026-07-18' }),
      node('c', 't1', { targetDate: '2026-07-24' }),
      node('d', 't1', { targetDate: '2026-08-30' }),
    ];
    const list = upcoming([t], byTree([t], nodes), TODAY);
    expect(list.map((u) => u.node.id)).toEqual(['a', 'b', 'c']);
    expect(list.map((u) => u.when)).toEqual(['tomorrow', 'days', 'week']);
  });

  it('today and the past never appear (they live in the grid + the 🍂 talk)', () => {
    const t = tree('t1');
    const nodes = [
      node('today', 't1', { targetDate: TODAY }),
      node('past', 't1', { targetDate: '2026-07-01' }),
    ];
    expect(upcoming([t], byTree([t], nodes), TODAY)).toHaveLength(0);
  });

  it('whenWord maps the far future to «later»', () => {
    expect(whenWord(TODAY, '2026-08-30')).toBe('later');
  });
});

describe('caminitos', () => {
  it('orders steps by walking order and points «siguiente» at the first open stone', () => {
    const t = tree('t1');
    const parent = node('camino', 't1', { flow: 'steps', repeatsDaily: true });
    const s1 = node('s1', 't1', { parentId: 'camino', order: 10, status: 'achieved', achievedAt: 1 });
    const s2 = node('s2', 't1', { parentId: 'camino', order: 20 });
    const s3 = node('s3', 't1', { parentId: 'camino', order: 30, status: 'seed' });
    const [c] = caminitos([t], byTree([t], [parent, s1, s2, s3]));
    expect(c.steps.map((s) => s.id)).toEqual(['s1', 's2', 's3']);
    expect(c.nextId).toBe('s2');
  });

  it('a plain steps parent (no repeatsDaily) is not a caminito; all-bloomed has no next', () => {
    const t = tree('t1');
    const plain = node('plain', 't1', { flow: 'steps' });
    const p1 = node('p1', 't1', { parentId: 'plain' });
    const done = node('done', 't1', { flow: 'steps', repeatsDaily: true });
    const d1 = node('d1', 't1', { parentId: 'done', status: 'achieved', achievedAt: 1 });
    const list = caminitos([t], byTree([t], [plain, p1, done, d1]));
    expect(list).toHaveLength(1);
    expect(list[0].parent.id).toBe('done');
    expect(list[0].nextId).toBeNull();
  });
});
