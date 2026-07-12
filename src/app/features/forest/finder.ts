import { Tree, TreeNode } from '../../core/db/schema';

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
    if (foldText(tree.name).includes(q)) {
      hits.push({ treeId: tree.id, treeName: tree.name, nodeId: null, title: tree.name });
    }
    for (const node of nodesOf(tree.id)) {
      if (hits.length >= CAP) break;
      if (node.archivedAt || node.deletedAt) continue;
      if (foldText(node.title).includes(q)) {
        hits.push({ treeId: tree.id, treeName: tree.name, nodeId: node.id, title: node.title });
      }
    }
  }
  return hits;
}
