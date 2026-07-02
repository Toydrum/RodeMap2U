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

const SLOT_W = 96;
const LEVEL_H = 110;
const JITTER_X = 10;
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
 */
export function edgeGeometry(parent: LayoutPoint, child: LayoutPoint): EdgeGeometry {
  const dy = child.y - parent.y; // negative (upward)
  const h = hash(child.node.id);
  const hand = h % 2 === 0 ? 1 : -1;
  const bowBase = 14 + (h % 18);
  const bow = hand * bowBase * Math.max(0.5, 1.4 - child.depth * 0.18);
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

/** Thick trunk, thin twigs — real-tree taper. */
export function edgeWidth(depth: number): number {
  return Math.max(3, 19 - depth * 4.5);
}
