import { TreeNode } from '../../core/db/schema';

/**
 * Pure tree layout: leaf-slot layered algorithm with deterministic organic
 * jitter. Root(s) at the bottom, growth goes UP (y decreases with depth).
 *
 * Post-order walk — each leaf takes the next x slot; each parent centers over
 * its descendants' slot span. Subtree spans are disjoint, so overlap is
 * impossible by construction. Jitter is a hash of the node's stable UUID, so
 * the tree NEVER reshuffles between sessions.
 */

export interface LayoutPoint {
  node: TreeNode;
  x: number;
  y: number;
  depth: number;
  parent: LayoutPoint | null;
}

export interface TreeLayout {
  points: LayoutPoint[];
  byId: Map<string, LayoutPoint>;
  width: number;
  height: number;
  minX: number;
  minY: number;
}

export const SLOT_W = 78;
const LEVEL_H = 100;
const JITTER_X = 8;
const JITTER_Y = 8;

/** Small deterministic string hash (FNV-1a flavored). */
export function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function layoutTree(
  roots: TreeNode[],
  childrenOf: (node: TreeNode) => TreeNode[],
): TreeLayout {
  const points: LayoutPoint[] = [];
  const byId = new Map<string, LayoutPoint>();
  let nextSlot = 0;

  const place = (node: TreeNode, depth: number, parent: LayoutPoint | null): LayoutPoint => {
    const children = childrenOf(node);
    const point: LayoutPoint = { node, x: 0, y: 0, depth, parent };

    if (children.length === 0) {
      point.x = nextSlot * SLOT_W;
      nextSlot++;
    } else {
      const placed = children.map((child) => place(child, depth + 1, point));
      const first = placed[0].x;
      const last = placed[placed.length - 1].x;
      point.x = (first + last) / 2;
    }

    const h = hash(node.id);
    point.x += ((h % (JITTER_X * 2 + 1)) - JITTER_X);
    point.y = -depth * LEVEL_H + (((h >> 7) % (JITTER_Y * 2 + 1)) - JITTER_Y);

    points.push(point);
    byId.set(node.id, point);
    return point;
  };

  for (const root of roots) place(root, 0, null);

  if (!points.length) {
    return { points, byId, width: 0, height: 0, minX: 0, minY: 0 };
  }

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return {
    points,
    byId,
    width: Math.max(...xs) - minX,
    height: Math.max(...ys) - minY,
    minX,
    minY,
  };
}

export interface EdgeGeometry {
  d: string;
  c1x: number;
  c1y: number;
  c2x: number;
  c2y: number;
}

/**
 * Organic cubic bezier from parent to child (child sits above the parent).
 * Thick limbs bow more; twigs stay tighter — the vecteezy-silhouette look.
 * `bowScale` lets miniature renders damp the curvature (absolute bow values
 * over compressed coordinates read as seaweed otherwise).
 */
export function edgeGeometry(parent: LayoutPoint, child: LayoutPoint, bowScale = 1): EdgeGeometry {
  const dy = child.y - parent.y; // negative (upward)
  const h = hash(child.node.id);
  const hand = h % 2 === 0 ? 1 : -1;
  const bowBase = 14 + (h % 18);
  const bow = hand * bowBase * Math.max(0.5, 1.4 - child.depth * 0.18) * bowScale;
  const c1x = parent.x + bow * 0.5;
  const c1y = parent.y + dy * 0.45;
  const c2x = child.x - bow * 0.7;
  const c2y = child.y - dy * 0.35;
  return {
    d: `M ${parent.x} ${parent.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${child.x} ${child.y}`,
    c1x,
    c1y,
    c2x,
    c2y,
  };
}

/** Point at parameter t along the edge's cubic bezier (for leaf placement). */
export function edgePointAt(
  parent: LayoutPoint,
  child: LayoutPoint,
  geometry: EdgeGeometry,
  t: number,
): { x: number; y: number } {
  const u = 1 - t;
  const x =
    u * u * u * parent.x + 3 * u * u * t * geometry.c1x + 3 * u * t * t * geometry.c2x + t * t * t * child.x;
  const y =
    u * u * u * parent.y + 3 * u * u * t * geometry.c1y + 3 * u * t * t * geometry.c2y + t * t * t * child.y;
  return { x, y };
}

/** Wood width by depth — exponential taper like a real tree. */
export function widthAtDepth(depth: number): number {
  return Math.max(2.6, 18 * Math.pow(0.6, depth));
}

/**
 * A branch as a FILLED tapered ribbon (not a uniform stroke): the cubic
 * centerline is sampled, offset perpendicular by a half-width that eases
 * from the parent's wood width to the child's — smooth joints, no sausage
 * caps, real timber.
 */
export function taperedRibbon(
  x0: number,
  y0: number,
  c1x: number,
  c1y: number,
  c2x: number,
  c2y: number,
  x1: number,
  y1: number,
  w0: number,
  w1: number,
): string {
  const N = 14;
  const left: string[] = [];
  const right: string[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const u = 1 - t;
    const x = u * u * u * x0 + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * x1;
    const y = u * u * u * y0 + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * y1;
    const dx = 3 * u * u * (c1x - x0) + 6 * u * t * (c2x - c1x) + 3 * t * t * (x1 - c2x);
    const dy = 3 * u * u * (c1y - y0) + 6 * u * t * (c2y - c1y) + 3 * t * t * (y1 - c2y);
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    // ease the taper so limbs stay sturdy near the joint and slim at the tip
    const eased = t * t * (3 - 2 * t);
    const hw = (w0 + (w1 - w0) * eased) / 2;
    left.push(`${(x + nx * hw).toFixed(1)} ${(y + ny * hw).toFixed(1)}`);
    right.push(`${(x - nx * hw).toFixed(1)} ${(y - ny * hw).toFixed(1)}`);
  }
  return `M ${left[0]} L ${left.slice(1).join(' L ')} L ${right.reverse().join(' L ')} Z`;
}

/** Ribbon for a parent→child edge, widths derived from tree depth. */
export function branchRibbon(
  parent: LayoutPoint,
  child: LayoutPoint,
  geometry: EdgeGeometry,
  childIsLeaf: boolean,
): string {
  const w0 = widthAtDepth(parent.depth) * 0.82;
  const w1 = widthAtDepth(child.depth) * (childIsLeaf ? 0.45 : 0.82);
  return taperedRibbon(
    parent.x,
    parent.y,
    geometry.c1x,
    geometry.c1y,
    geometry.c2x,
    geometry.c2y,
    child.x,
    child.y,
    w0,
    w1,
  );
}
