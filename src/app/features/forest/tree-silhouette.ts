import {
  EdgeGeometry,
  LayoutPoint,
  TreeLayout,
  edgeGeometry,
  edgePointAt,
  hash,
  ribbonWidthAt,
  taperedRibbon,
  widthForMass,
} from './tree-layout';
import { TreeForm } from './tree-forms';

/**
 * The silhouette brain (B5, 0.0.78) — every pure decision about how a tree's
 * WOOD and FOLIAGE are drawn, extracted from tree-canvas.ts so it can be
 * unit-tested. No Angular here: the component wires live signals into these
 * functions. All variation is hash-of-id deterministic (never Math.random);
 * node POSITIONS are never touched — this module is render-side only.
 */

export interface LeafDecoration {
  x: number;
  y: number;
  angle: number;
  size: number;
  kind: 'leaf' | 'blossom';
  /** Shape family (almond / willow / round / asymmetric). */
  variant: number;
  /** Green shade (base / deep / warm) — overlap reads as real foliage. */
  shade: number;
}

export interface PadDecoration {
  x: number;
  y: number;
  rx: number;
  ry: number;
  rot: number;
  shade: number;
}

/** How one limb is drawn: where it starts (the parent point, or an anchor
 *  along the leader limb for side forks), its curve, and its wood widths. */
export interface LimbPlan {
  start: { x: number; y: number };
  geom: EdgeGeometry;
  w0: number;
  w1: number;
  isLeaf: boolean;
}

/** Each tree's wood personality: sinuosity, girth and bark family. */
export interface TreeWood {
  bow: number;
  girth: number;
  barkBase: string;
}

/** A leaf point in the DRAWN sense: no children and not a chain link. */
export type TipPredicate = (p: LayoutPoint) => boolean;

/** Each tree grows its own wood: sinuosity, girth and bark family.
 *  Birch identity: a pale wash mixed over whichever family it drew. */
export function woodFor(treeId: string, form: TreeForm): TreeWood {
  const h = hash(treeId + ':wood');
  const family = [
    'var(--rm-bark)',
    'color-mix(in srgb, var(--rm-bark) 68%, #4a3826)',
    'color-mix(in srgb, var(--rm-bark) 72%, #94815f)',
  ][h % 3];
  return {
    bow: 0.85 + (h % 46) / 100,
    girth: 0.88 + ((h >> 5) % 28) / 100,
    barkBase:
      form.barkTint === 'pale' ? `color-mix(in srgb, ${family} 42%, #e8e2d2)` : family,
  };
}

/** Bark near the trunk, greener toward the twigs; branch-children lean golden. */
export function woodFill(point: LayoutPoint, wood: TreeWood): string {
  const jitter = (hash(point.node.id + ':barkjit') % 9) - 4;
  const barkPct = Math.min(94, Math.max(28, 92 - point.depth * 16 + jitter));
  const base = `color-mix(in srgb, ${wood.barkBase} ${barkPct}%, var(--rm-twig))`;
  return point.node.origin === 'branch'
    ? `color-mix(in srgb, ${base} 72%, var(--status-branched))`
    : base;
}

/** Trunk width response (0.0.80): leaf-mass rules a grown tree, but EVERY
 *  planted branch thickens a young trunk a little — mass counts LEAVES, so
 *  the first child used to leave the trunk newborn-thin. The boosted top
 *  is always ≥ the leader limb's mass-based w0, so the limb emerges from
 *  inside the trunk (a natural collar, never a step up). */
export function trunkDims(
  root: LayoutPoint,
  wood: TreeWood,
  form: TreeForm,
  branchCount: number,
): { top: number; base: number } {
  const girth = wood.girth * form.girthMul;
  const effMass = Math.max(root.mass ?? 1, 1 + (branchCount - 1) * 0.6);
  const top = widthForMass(effMass, girth);
  return { top, base: Math.min(34, top * 1.8) };
}

/** The trunk's swayed foot x — ribbon and flare must share it. */
function trunkFootX(root: LayoutPoint, wood: TreeWood): number {
  return root.x + ((hash(root.node.id + ':trunk') % 21) - 10) * 0.6 * wood.bow;
}

/** Trunk ribbon: ground → root, with a gentle sway (0.0.80 dims: every
 *  planted branch thickens it a little, base flares 1.8×). */
export function trunkPath(
  root: LayoutPoint,
  groundY: number,
  wood: TreeWood,
  form: TreeForm,
  branchCount: number,
): string {
  const gy = groundY;
  const { top, base } = trunkDims(root, wood, form, branchCount);
  const sway = trunkFootX(root, wood) - root.x;
  return taperedRibbon(
    root.x + sway,
    gy - 2,
    root.x + sway * 0.4,
    gy - (gy - root.y) * 0.4,
    root.x - sway * 0.3,
    root.y + (gy - root.y) * 0.35,
    root.x,
    root.y,
    base,
    top,
  );
}

/** Root flare (0.0.80): proportional toes hugging the trunk's REAL foot,
 *  rendered as a sibling path with the SAME fill — the old hump was a
 *  fixed 44px, differently-colored blob centered on root.x while the
 *  swayed foot landed beside it (a stick pushed into a mound). Kept as a
 *  separate element on purpose: merging both subpaths into one `d` made
 *  their opposite windings cancel under fill-rule nonzero (a pale hole
 *  where ribbon and flare overlap). */
export function trunkFlarePath(
  root: LayoutPoint,
  groundY: number,
  wood: TreeWood,
  form: TreeForm,
  branchCount: number,
): string {
  const gy = groundY;
  const { base } = trunkDims(root, wood, form, branchCount);
  const fx = trunkFootX(root, wood);
  const half = Math.min(40, Math.max(base * 1.5, 12));
  const h = Math.min(14, 4 + base * 0.45);
  return (
    `M ${fx - half} ${gy - 1}` +
    ` Q ${fx - half * 0.42} ${gy - h} ${fx} ${gy - h * 0.9}` +
    ` Q ${fx + half * 0.42} ${gy - h} ${fx + half} ${gy - 1}` +
    ` Q ${fx} ${gy + 3} ${fx - half} ${gy - 1} Z`
  );
}

/** The silhouette brain: how every limb is drawn. Per parent, the child
 *  carrying the most leaf-mass is the LEADER — its edge continues the
 *  trunk line (calm bow, opposite hand, full width); the other children
 *  fork off the leader limb at staggered heights (their wood starts at an
 *  anchor along it, node positions untouched). Chains keep their classic
 *  vertical treatment — they already ARE a continuation. */
export function planLimbs(
  points: LayoutPoint[],
  form: TreeForm,
  wood: TreeWood,
  treeId: string,
  tip: TipPredicate,
): Map<string, LimbPlan> {
  const plan = new Map<string, LimbPlan>();
  const f = form;
  const girth = wood.girth * f.girthMul;
  const width = (p: LayoutPoint) => widthForMass(p.mass ?? 1, girth);

  const byParent = new Map<string, LayoutPoint[]>();
  for (const p of points) {
    if (!p.parent) continue;
    const list = byParent.get(p.parent.node.id) ?? [];
    list.push(p);
    byParent.set(p.parent.node.id, list);
  }

  for (const children of byParent.values()) {
    const parent = children[0].parent!;
    const normal = children.filter((c) => !c.chain);

    // Chain links: exactly the classic path — vertical, no leader math.
    for (const c of children.filter((x) => x.chain)) {
      const geom = edgeGeometry(parent, c, wood.bow);
      plan.set(c.node.id, {
        start: parent,
        geom,
        w0: width(parent) * 0.9,
        w1: Math.max(2.4, width(c) * (tip(c) ? 0.45 : 0.95)),
        isLeaf: tip(c),
      });
    }
    if (!normal.length) continue;

    // LEADER choice (0.0.62 — the left-lean fix). Mass still carries the
    // trunk when a subtree is CLEARLY heavier (>15% over every rival — the
    // da Vinci story stands). Near-ties go to the most CENTRAL child, so
    // the trunk continues UPWARD instead of diving into the leftmost slot
    // (the old `>` on tied masses always kept normal[0] — every fresh fork
    // leaned left, every tree repeated one silhouette). Exact central ties
    // break by per-tree hash: same structure, different tree, different —
    // but equally plausible — leader.
    const maxMass = Math.max(...normal.map((c) => c.mass ?? 1));
    const contenders = normal.filter((c) => (c.mass ?? 1) >= maxMass * 0.85);
    const centrality = (c: LayoutPoint) => Math.abs(c.x - parent.x);
    const minCentrality = Math.min(...contenders.map(centrality));
    const central = contenders.filter((c) => centrality(c) - minCentrality <= 0.5);
    const leader = central[hash(treeId + parent.node.id + ':leader') % central.length];

    // zigzag habit (birch): the leader hand alternates by depth instead of
    // by hash — the trunk kinks side to side on its way up.
    const zigzag = f.habit === 'zigzag';
    const parentHand: 1 | -1 = zigzag
      ? parent.depth % 2 === 0
        ? 1
        : -1
      : hash(parent.node.id) % 2 === 0
        ? 1
        : -1;
    const leaderGeom = edgeGeometry(parent, leader, wood.bow, {
      upBias: Math.min(0.95, f.upBias + 0.5 * f.leaderBias),
      bowMul: f.bowMul * (1 - f.leaderBias) * (zigzag ? 1.25 : 1),
      hand: (parentHand * -1) as 1 | -1,
    });
    const leaderW0 = width(parent) * 0.98;
    const leaderW1 = Math.max(2.4, width(leader) * (tip(leader) ? 0.45 : 1));
    plan.set(leader.node.id, {
      start: parent,
      geom: leaderGeom,
      w0: leaderW0,
      w1: leaderW1,
      isLeaf: tip(leader),
    });

    // Real-tree fork order: the FARTHEST-reaching side limb leaves LOWEST
    // (it needs the longest run), short twigs fork higher up — sorted by
    // horizontal reach so ribbons never cross into parallel-rail tangles.
    const sides = normal
      .filter((c) => c !== leader)
      .sort((a, b) => Math.abs(b.x - parent.x) - Math.abs(a.x - parent.x));
    // Crowded forks spread over a wider window and slim their collars so
    // the crotch never welds into one wooden blob.
    const tMax = sides.length >= 4 ? Math.min(0.92, f.forkTMax + 0.12) : f.forkTMax;
    const span = tMax - f.forkTMin;
    const tiered = f.habit === 'tiered';
    const collarMul = (sides.length >= 4 ? 0.78 : 0.9) * (tiered ? 0.8 : 1);
    sides.forEach((c, i) => {
      const h = hash(c.node.id + ':fork');
      const t = f.forkTMin + span * ((i + 0.35 + (h % 31) / 120) / Math.max(1, sides.length));
      const start = edgePointAt(parent, leader, leaderGeom, t);
      // Habits bend the ARRIVAL only (positions untouched):
      // weeping — tip limbs hang (negative upBias, the willow's fall);
      // tiered — side limbs sweep out-and-slightly-down (conifer shelves).
      let b = f.upBias + ((h >> 5) % 21) / 100 - 0.1;
      let lo = 0.1;
      let hi = 0.9;
      if (f.habit === 'weeping' && tip(c)) {
        b -= 0.55;
        lo = -0.35;
      } else if (tiered) {
        b -= 0.9;
        lo = -0.18;
        hi = 0.08;
      }
      const geom = edgeGeometry(start, c, wood.bow, {
        upBias: Math.max(lo, Math.min(hi, b)),
        bowMul: f.bowMul * (tiered ? 0.6 : 1),
      });
      // A limb may flare at its collar but never outgrow the wood it forks from.
      const collar = collarMul * ribbonWidthAt(leaderW0, leaderW1, t);
      plan.set(c.node.id, {
        start,
        geom,
        w0: Math.min(width(c) * 1.25, Math.max(2.6, collar)),
        w1: Math.max(2.4, width(c) * (tip(c) ? 0.45 : 0.9)),
        isLeaf: tip(c),
      });
    });
  }
  return plan;
}

/** Deterministic foliage: leaf slots scale with limb length, some sprout
 *  opposite twins (leaf pairs), and twig tips gather a tuft. */
export function leavesFor(
  point: LayoutPoint,
  start: { x: number; y: number },
  geometry: EdgeGeometry,
  form: TreeForm,
): LeafDecoration[] {
  const status = point.node.status;
  const f = form;
  const h = hash(point.node.id + ':leaves');
  const length = Math.hypot(point.x - start.x, point.y - start.y);
  // One leaf slot every ~10-14px of limb; resting stays deliberately sparse;
  // the form's density dial gives acacias their air between pads.
  const spacing = status === 'achieved' ? 10 : status === 'growing' ? 11 : status === 'resting' ? 30 : 14;
  const density = status === 'resting' ? 1 : f.leafDensityMul;
  const slots = Math.max(
    status === 'resting' ? 2 : 3,
    Math.min(14, Math.round((length / spacing) * density)),
  );
  const leaves: LeafDecoration[] = [];
  for (let i = 0; i < slots; i++) {
    const hi = hash(point.node.id + ':leaf:' + i);
    const t = Math.min(0.93, 0.16 + (i / slots) * 0.72 + ((hi % 10) / 100));
    const at = edgePointAt(start, point, geometry, t);
    const side = (i + (h % 2)) % 2 === 0 ? 1 : -1;
    leaves.push({
      x: at.x + side * (3 + (hi % 6)),
      y: at.y,
      angle: side * (26 + (hi % 55)),
      size: 5 + ((hi >> 4) % 4),
      kind: status === 'achieved' && i === 0 ? 'blossom' : 'leaf',
      variant: hi % 4,
      shade: (hi >> 5) % 3,
    });
    // Some slots sprout an opposite twin — pairs read as real foliage.
    if (hi % 5 < 2 && status !== 'resting') {
      leaves.push({
        x: at.x - side * (3 + ((hi >> 3) % 5)),
        y: at.y + 1,
        angle: -side * (30 + ((hi >> 5) % 45)),
        size: 4.5 + ((hi >> 7) % 3),
        kind: 'leaf',
        variant: (hi >> 8) % 4,
        shade: (hi >> 11) % 3,
      });
    }
  }
  return leaves;
}

/** Foliage PADS: soft clustered volumes at branch tips — how real crowns
 *  read from afar (the tuft, grown up). Resting stays winter-quiet;
 *  growing keeps its sapling glyph clear. */
export function padsFor(
  point: LayoutPoint,
  start: { x: number; y: number },
  geometry: EdgeGeometry,
  isTip: boolean,
  form: TreeForm,
): PadDecoration[] {
  const f = form;
  const status = point.node.status;
  if (!isTip || status === 'branched' || status === 'resting') return [];
  const h = hash(point.node.id + ':pads');
  const count = f.padCount[0] + (h % (f.padCount[1] - f.padCount[0] + 1));
  const tLo = status === 'growing' ? 0.6 : 0.82;
  const tHi = status === 'growing' ? 0.78 : 0.98;
  // Weeping tips hang — their foliage gathers BELOW the tip, like a
  // willow's curtain, instead of crowning above it.
  const droop = f.habit === 'weeping' ? 1 : -1;
  const pads: PadDecoration[] = [];
  for (let i = 0; i < count; i++) {
    const hi = hash(point.node.id + ':pad:' + i);
    const t = tLo + ((i + (hi % 30) / 100) / count) * (tHi - tLo);
    const at = edgePointAt(start, point, geometry, Math.min(0.99, t));
    const x = at.x + (((hi >> 3) % (f.padSpread * 2 + 1)) - f.padSpread);
    const y = at.y + droop * ((hi >> 6) % Math.max(2, Math.round(f.padSpread * 0.8)));
    // The growing sapling glyph must stay visible through its crown.
    if (status === 'growing' && Math.hypot(x - point.x, y - point.y) < 18) continue;
    pads.push({
      x,
      y,
      rx: f.padRx[0] + ((hi >> 9) % (f.padRx[1] - f.padRx[0] + 1)),
      ry: f.padRy[0] + ((hi >> 12) % (f.padRy[1] - f.padRy[0] + 1)),
      rot: f.id === 'acacia' ? ((hi >> 15) % 13) - 6 : ((hi >> 15) % 41) - 20,
      shade: (hi >> 5) % 3,
    });
  }
  return pads;
}

/** World-space life around the base: grass clusters + a few flowers. */
export function groundDecorFor(
  layout: TreeLayout,
  treeId: string,
  groundY: number,
): {
  grass: { x: number; y: number; flip: boolean }[];
  flowers: { x: number; y: number; scale: number; sway: number }[];
} {
  if (!layout.points.length) return { grass: [], flowers: [] };
  const centerX = layout.minX + layout.width / 2;
  const spread = Math.max(240, layout.width * 0.9);
  const gy = groundY;

  const grass = Array.from({ length: 7 }, (_, i) => {
    const h = hash(treeId + ':g' + i);
    return {
      x: centerX - spread + ((h % 1000) / 1000) * spread * 2,
      y: gy - 8 + ((h >> 8) % 14),
      flip: h % 2 === 0,
    };
  });

  const flowers = Array.from({ length: 3 }, (_, i) => {
    const h = hash(treeId + ':f' + i);
    return {
      x: centerX - spread * 0.9 + ((h % 1000) / 1000) * spread * 1.8,
      y: gy - 4 + ((h >> 6) % 10),
      scale: 0.32 + ((h >> 4) % 14) / 100,
      sway: -10 + (h % 21),
    };
  });

  return { grass, flowers };
}
