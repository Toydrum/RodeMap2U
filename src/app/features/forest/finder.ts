import { Tree, TreeNode } from '../../core/db/schema';
import { heartOf, isRoot } from '../../core/heart';

/**
 * «Buscar una rama» — a small utilitarian finder (COGA: help users find
 * what they need). Accent/case-insensitive substring match over active
 * tree names and live branch titles; results grouped by tree, capped so
 * the list never overwhelms. Pure — no Angular, unit-testable.
 */

export interface FinderHit {
  treeId: string;
  treeName: string;
  /** null = the TREE name matched (open it); else the matching branch. */
  nodeId: string | null;
  title: string;
}

const CAP = 12;

/** Lowercase + strip combining accents — «Práctica» matches "practica". */
export function foldText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

export function findMatches(
  query: string,
  trees: readonly Tree[],
  nodesOf: (treeId: string) => readonly TreeNode[],
): FinderHit[] {
  const q = foldText(query.trim());
  if (q.length < 2) return [];
  const hits: FinderHit[] = [];
  for (const tree of trees) {
    if (hits.length >= CAP) break;
    const treeMatched = foldText(tree.name).includes(q);
    if (treeMatched) {
      hits.push({ treeId: tree.id, treeName: tree.name, nodeId: null, title: tree.name });
    }
    const live = nodesOf(tree.id).filter((n) => !n.archivedAt && !n.deletedAt);
    const heart = heartOf(live.filter(isRoot));
    for (const node of live) {
      if (hits.length >= CAP) break;
      // «El corazón del árbol» (0.0.112): when the tree itself already hit,
      // its heart is the SAME door — re-emitting it doubled the result
      // («trabajo» used to appear as tree AND as its homonymous branch).
      if (treeMatched && heart && node.id === heart.id) continue;
      if (foldText(node.title).includes(q)) {
        hits.push({ treeId: tree.id, treeName: tree.name, nodeId: node.id, title: node.title });
      }
    }
  }
  return hits;
}
