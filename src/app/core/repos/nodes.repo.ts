import { Injectable, computed, inject } from '@angular/core';
import { NodeStatus, TreeNode, newSyncBase, stamp } from '../db/schema';
import { StoreName } from '../db/idb';
import { RecordsRepo } from './records.repo';
import { TreesRepo } from './trees.repo';
import { isPast } from '../time';

export interface NewNodeDraft {
  title: string;
  note?: string;
  targetDate?: string | null;
}

@Injectable({ providedIn: 'root' })
export class NodesRepo extends RecordsRepo<TreeNode> {
  protected readonly store: StoreName = 'nodes';
  private readonly treesRef = inject(TreesRepo);

  /** A finished place releases the "you are here" pin — you can't stay at a bloom. */
  private async releaseHereIfFinished(node: TreeNode, status: NodeStatus): Promise<void> {
    if (status !== 'achieved' && status !== 'branched') return;
    const tree = this.treesRef.byId().get(node.treeId);
    if (tree && tree.currentNodeId === node.id) {
      await this.treesRef.setCurrentNode(tree, null);
    }
  }

  /** Visible nodes (not tombstoned, not archived). */
  readonly visible = computed(() => this.all().filter((n) => !n.archivedAt));

  readonly byTree = computed(() => {
    const map = new Map<string, TreeNode[]>();
    for (const node of this.visible()) {
      const list = map.get(node.treeId) ?? [];
      list.push(node);
      map.set(node.treeId, list);
    }
    return map;
  });

  /** parentId ('root' for null) → ordered children. */
  readonly childrenIndex = computed(() => {
    const map = new Map<string, TreeNode[]>();
    for (const node of this.visible()) {
      const key = node.parentId ?? `root:${node.treeId}`;
      const list = map.get(key) ?? [];
      list.push(node);
      map.set(key, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.order - b.order);
    return map;
  });

  /** Nodes whose gentle date has passed and is still unhandled. */
  readonly needsDateReview = computed(() =>
    this.visible().filter(
      (n) =>
        n.targetDate !== null &&
        isPast(n.targetDate) &&
        n.status !== 'achieved' &&
        n.status !== 'branched',
    ),
  );

  childrenOf(node: TreeNode): TreeNode[] {
    return this.childrenIndex().get(node.id) ?? [];
  }

  rootsOf(treeId: string): TreeNode[] {
    return this.childrenIndex().get(`root:${treeId}`) ?? [];
  }

  async plant(treeId: string, parentId: string | null, draft: NewNodeDraft): Promise<TreeNode> {
    const siblings = parentId
      ? (this.childrenIndex().get(parentId) ?? [])
      : this.rootsOf(treeId);
    const maxOrder = Math.max(0, ...siblings.map((s) => s.order));
    const node: TreeNode = {
      ...newSyncBase(),
      treeId,
      parentId,
      title: draft.title,
      note: draft.note ?? '',
      status: 'seed',
      order: maxOrder + 10,
      targetDate: draft.targetDate ?? null,
      achievedAt: null,
      branchedAt: null,
      origin: 'planned',
      archivedAt: null,
    };
    return this.insert(node);
  }

  async setStatus(node: TreeNode, status: NodeStatus): Promise<TreeNode> {
    const saved = await this.save({
      ...node,
      status,
      achievedAt: status === 'achieved' ? Date.now() : node.achievedAt,
    });
    await this.releaseHereIfFinished(node, status);
    return saved;
  }

  async update(node: TreeNode, patch: Partial<Pick<TreeNode, 'title' | 'note' | 'targetDate'>>): Promise<TreeNode> {
    return this.save({ ...node, ...patch });
  }

  async archiveSubtree(node: TreeNode): Promise<void> {
    const now = Date.now();
    const toArchive: TreeNode[] = [];
    const walk = (current: TreeNode) => {
      toArchive.push(stamp({ ...current, archivedAt: now }, now));
      for (const child of this.childrenOf(current)) walk(child);
    };
    walk(node);
    await this.saveMany(toArchive);
  }

  /** Permanent removal (sync tombstones) for a whole tree's nodes — atomic. */
  async tombstoneMany(records: TreeNode[]): Promise<void> {
    const now = Date.now();
    await this.saveMany(records.map((n) => stamp({ ...n, deletedAt: now }, now)));
  }

  /**
   * The heart: a passed date becomes a branch point. Atomic — parent flips to
   * 'branched' (original targetDate preserved as history) and the alternatives
   * are born in the same IndexedDB transaction.
   */
  async branch(parent: TreeNode, alternatives: NewNodeDraft[]): Promise<TreeNode[]> {
    const now = Date.now();
    const branchedParent = stamp(
      { ...parent, status: 'branched' as NodeStatus, branchedAt: now },
      now,
    );
    const children = alternatives.map((draft, i) => ({
      ...newSyncBase(now),
      treeId: parent.treeId,
      parentId: parent.id,
      title: draft.title,
      note: draft.note ?? '',
      status: 'seed' as NodeStatus,
      order: (i + 1) * 10,
      targetDate: draft.targetDate ?? null,
      achievedAt: null,
      branchedAt: null,
      origin: 'branch' as const,
      archivedAt: null,
    }));
    await this.saveMany([branchedParent, ...children]);
    await this.releaseHereIfFinished(parent, 'branched');
    return children;
  }
}
