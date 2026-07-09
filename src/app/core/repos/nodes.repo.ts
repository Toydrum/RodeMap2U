import { Injectable, computed } from '@angular/core';
import { NodeStatus, TreeNode, lightRank, newSyncBase, stamp } from '../db/schema';
import { StoreName } from '../db/idb';
import { RecordsRepo } from './records.repo';
import { isPast } from '../time';

export interface NewNodeDraft {
  title: string;
  note?: string;
  targetDate?: string | null;
}

@Injectable({ providedIn: 'root' })
export class NodesRepo extends RecordsRepo<TreeNode> {
  protected readonly store: StoreName = 'nodes';

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

  /** Nodes whose gentle date has passed and is still unhandled — sunlit
   *  conversations first, then oldest date, deterministic tail. */
  readonly needsDateReview = computed(() =>
    this.visible()
      .filter(
        (n) =>
          n.targetDate !== null &&
          isPast(n.targetDate) &&
          n.status !== 'achieved' &&
          n.status !== 'branched',
      )
      .sort(
        (a, b) =>
          lightRank(a) - lightRank(b) ||
          (a.targetDate ?? '').localeCompare(b.targetDate ?? '') ||
          a.id.localeCompare(b.id),
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
      trigger: null,
    };
    return this.insert(node);
  }

  async setStatus(node: TreeNode, status: NodeStatus): Promise<TreeNode> {
    return this.save({
      ...node,
      status,
      achievedAt: status === 'achieved' ? Date.now() : node.achievedAt,
    });
  }

  async update(
    node: TreeNode,
    patch: Partial<Pick<TreeNode, 'title' | 'note' | 'targetDate' | 'trigger' | 'flow' | 'priority'>>,
  ): Promise<TreeNode> {
    return this.save({ ...node, ...patch });
  }

  /** Swap a step with its neighbor — the app's first node reorder. Both
   *  records re-stamp in one atomic write; a no-op at either end. */
  async moveStep(node: TreeNode, dir: -1 | 1): Promise<void> {
    const siblings = node.parentId
      ? (this.childrenIndex().get(node.parentId) ?? [])
      : this.rootsOf(node.treeId);
    const idx = siblings.findIndex((s) => s.id === node.id);
    const other = siblings[idx + dir];
    if (idx === -1 || !other) return;
    const now = Date.now();
    await this.saveMany([
      stamp({ ...node, order: other.order }, now),
      stamp({ ...other, order: node.order }, now),
    ]);
  }

  /** Returns the archived records so callers can offer an undo. */
  async archiveSubtree(node: TreeNode): Promise<TreeNode[]> {
    const now = Date.now();
    const toArchive: TreeNode[] = [];
    const walk = (current: TreeNode) => {
      toArchive.push(stamp({ ...current, archivedAt: now }, now));
      for (const child of this.childrenOf(current)) walk(child);
    };
    walk(node);
    await this.saveMany(toArchive);
    return toArchive;
  }

  /** Inverse of archiveSubtree — one atomic write. Re-reads live records and
   *  re-stamps so the restore's rev moves PAST the archive write (cross-tab
   *  LWW accepts it); already-restored records are skipped (double-tap safe). */
  async unarchiveMany(records: TreeNode[]): Promise<void> {
    const now = Date.now();
    const fresh = records
      .map((r) => this.byId().get(r.id) ?? r)
      .filter((r) => r.archivedAt !== null)
      .map((r) => stamp({ ...r, archivedAt: null }, now));
    if (fresh.length) await this.saveMany(fresh);
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
      trigger: null,
    }));
    await this.saveMany([branchedParent, ...children]);
    return children;
  }

  /**
   * The only exit from 'branched' — undo of a branching, atomic. The parent
   * leaves the knot and its origin:'branch' children leave with it as sync
   * tombstones (archived nodes are invisible in every UI; a tombstone is the
   * honest shape, still travels in backups). Default landing is 'growing' +
   * dateless: a preserved past targetDate must NOT re-arm date-review
   * (mirrors date-review's keepGoing). Returns the removed children so the
   * caller can repair the tree's currentNodeId.
   */
  async revertBranch(
    parent: TreeNode,
    restoreTo: { status: NodeStatus; targetDate: string | null } = {
      status: 'growing',
      targetDate: null,
    },
  ): Promise<TreeNode[]> {
    const now = Date.now();
    const children = this.childrenOf(parent).filter((c) => c.origin === 'branch');
    const reverted = stamp(
      { ...parent, status: restoreTo.status, targetDate: restoreTo.targetDate, branchedAt: null },
      now,
    );
    await this.saveMany([reverted, ...children.map((c) => stamp({ ...c, deletedAt: now }, now))]);
    return children;
  }
}
