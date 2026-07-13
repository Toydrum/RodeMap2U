import { describe, expect, it } from 'vitest';
import { TreeNode } from '../../core/db/schema';
import { LayoutPoint, edgeGeometry, layoutTree } from './tree-layout';
import { formFor } from './tree-forms';
import { leavesFor, padsFor, planLimbs, woodFor } from './tree-silhouette';

function node(id: string, parentId: string | null, extra: Partial<TreeNode> = {}): TreeNode {
  return {
    id,
    createdAt: 0,
    updatedAt: 0,
    rev: 1,
    deletedAt: null,
    treeId: 't1',
    parentId,
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

function lay(nodes: TreeNode[]) {
  const roots = nodes.filter((n) => n.parentId === null);
  const childrenOf = (n: TreeNode) => nodes.filter((c) => c.parentId === n.id);
  return layoutTree(roots, childrenOf);
}

function planOf(nodes: TreeNode[], accent = 'moss' as const, treeId = 'tree-1') {
  const layout = lay(nodes);
  const form = formFor(accent);
  const wood = woodFor(treeId, form);
  const kids = (p: LayoutPoint) => nodes.filter((c) => c.parentId === p.node.id);
  const tip = (p: LayoutPoint) => kids(p).length === 0 && !p.chainNextId;
  return { layout, plan: planLimbs(layout.points, form, wood, treeId, tip), form, wood };
}

describe('woodFor', () => {
  it('same tree grows the same wood forever; different trees differ', () => {
    const form = formFor('moss');
    expect(woodFor('tree-a', form)).toEqual(woodFor('tree-a', form));
    const a = woodFor('tree-a', form);
    const b = woodFor('tree-b', form);
    expect(a.bow !== b.bow || a.girth !== b.girth || a.barkBase !== b.barkBase).toBe(true);
  });

  it('birch bark gets the pale wash', () => {
    expect(woodFor('t', formFor('sky')).barkBase).toContain('#e8e2d2');
  });
});

describe('planLimbs — the leader law (0.0.62)', () => {
  it('every non-root point gets a limb plan', () => {
    const nodes = [node('r', null), node('a', 'r'), node('b', 'r'), node('c', 'a')];
    const { plan } = planOf(nodes);
    for (const id of ['a', 'b', 'c']) expect(plan.has(id)).toBe(true);
    expect(plan.has('r')).toBe(false);
  });

  it('a CLEARLY heavier child continues the trunk (starts AT the parent)', () => {
    // 'heavy' carries 3 leaves; 'light' is a lone leaf — >15% margin, mass wins.
    const nodes = [
      node('r', null),
      node('heavy', 'r'),
      node('h1', 'heavy'),
      node('h2', 'heavy'),
      node('h3', 'heavy'),
      node('light', 'r'),
    ];
    const { layout, plan } = planOf(nodes);
    const parent = layout.byId.get('r')!;
    const heavyPlan = plan.get('heavy')!;
    const lightPlan = plan.get('light')!;
    expect(heavyPlan.start.x).toBe(parent.x);
    expect(heavyPlan.start.y).toBe(parent.y);
    // The side limb forks off the leader's wood, never at the parent point.
    expect(lightPlan.start.y).not.toBe(parent.y);
  });

  it('near-tied masses hand the trunk to the most CENTRAL child', () => {
    const nodes = [node('r', null), node('a', 'r'), node('b', 'r'), node('c', 'r')];
    const { layout, plan } = planOf(nodes);
    const parent = layout.byId.get('r')!;
    const central = ['a', 'b', 'c']
      .map((id) => layout.byId.get(id)!)
      .reduce((best, p) => (Math.abs(p.x - parent.x) < Math.abs(best.x - parent.x) ? p : best));
    const leaderPlan = plan.get(central.node.id)!;
    expect(leaderPlan.start.x).toBe(parent.x);
    expect(leaderPlan.start.y).toBe(parent.y);
  });

  it('chain links keep the classic vertical treatment (start at the parent)', () => {
    const nodes = [
      node('r', null, { flow: 'steps' }),
      node('s1', 'r', { order: 10 }),
      node('s2', 'r', { order: 20 }),
    ];
    const { layout, plan } = planOf(nodes);
    const s1 = plan.get('s1')!;
    const parent = layout.byId.get('r')!;
    expect(s1.start.x).toBe(parent.x);
    expect(s1.start.y).toBe(parent.y);
  });
});

describe('foliage', () => {
  const form = formFor('moss');
  const geomFor = (nodes: TreeNode[], id: string) => {
    const layout = lay(nodes);
    const p = layout.byId.get(id)!;
    const parent = p.parent!;
    return { p, parent, geom: edgeGeometry(parent, p, 1) };
  };

  it('leaves are deterministic and resting branches stay sparse', () => {
    const busy = geomFor([node('r', null), node('a', 'r')], 'a');
    const one = leavesFor(busy.p, busy.parent, busy.geom, true, form);
    const two = leavesFor(busy.p, busy.parent, busy.geom, true, form);
    expect(one).toEqual(two);

    const rest = geomFor([node('r', null), node('a', 'r', { status: 'resting' })], 'a');
    const resting = leavesFor(rest.p, rest.parent, rest.geom, true, form);
    expect(resting.length).toBeLessThan(one.length);
  });

  it('an achieved branch opens its first slot as a blossom', () => {
    const done = geomFor([node('r', null), node('a', 'r', { status: 'achieved' })], 'a');
    const leaves = leavesFor(done.p, done.parent, done.geom, true, form);
    expect(leaves[0].kind).toBe('blossom');
  });

  it('pads crown only live tips; weeping tips hang their curtain BELOW', () => {
    const seedTip = geomFor([node('r', null), node('a', 'r', { status: 'seed' })], 'a');
    expect(padsFor(seedTip.p, seedTip.parent, seedTip.geom, false, form)).toEqual([]);
    const restingTip = geomFor([node('r', null), node('a', 'r', { status: 'resting' })], 'a');
    expect(padsFor(restingTip.p, restingTip.parent, restingTip.geom, true, form)).toEqual([]);

    const oakPads = padsFor(seedTip.p, seedTip.parent, seedTip.geom, true, form);
    const willow = formFor('sage');
    const willowPads = padsFor(seedTip.p, seedTip.parent, seedTip.geom, true, willow);
    expect(oakPads.length).toBeGreaterThan(0);
    expect(willowPads.length).toBeGreaterThan(0);
    // Oak crowns gather ABOVE the tip (y <= tip), the willow's fall BELOW.
    expect(Math.max(...willowPads.map((p) => p.y))).toBeGreaterThanOrEqual(
      Math.min(...oakPads.map((p) => p.y)),
    );
  });
});
