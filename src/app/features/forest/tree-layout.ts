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

const SLOT_W = 88;
const LEVEL_H = 104;
const JITTER_X = 8;
const JITTER_Y = 6;

/** Small deterministic string hash (FNV-1a flavored). */
function hash(text: string): number {
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

/** Organic cubic bezier from parent to child (child sits above the parent). */
export function edgePath(parent: LayoutPoint, child: LayoutPoint): string {
  const dy = child.y - parent.y; // negative (upward)
  const bow = ((hash(child.node.id) % 2 === 0 ? 1 : -1) * (8 + (hash(child.node.id) % 12)));
  const c1x = parent.x + bow * 0.4;
  const c1y = parent.y + dy * 0.42;
  const c2x = child.x - bow * 0.6;
  const c2y = child.y - dy * 0.38;
  return `M ${parent.x} ${parent.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${child.x} ${child.y}`;
}

/** Thick trunk, thin twigs. */
export function edgeWidth(depth: number): number {
  return Math.max(2.2, 9 - depth * 1.4);
}
