import { Injectable, computed } from '@angular/core';
import { Harvest, Tree, TreeNode, harvestIdFor, newSyncBase } from '../db/schema';
import { StoreName, get, put } from '../db/idb';
import { RecordsRepo } from './records.repo';
import { isFresh, underDailyPath } from '../harvest';

/**
 * «La cosecha» (0.0.88) — the pantry register. See the Harvest interface in
 * schema.ts for the laws (memory not currency; survives reopen/archive/
 * delete; sendero steps never bear fruit; deterministic id = idempotent
 * minting). Minting happens ONLY here via recordBloom, called from the
 * user-action layer (node sheet bloom sites) — sync, import and the daily
 * sweep never mint.
 */
@Injectable({ providedIn: 'root' })
export class HarvestsRepo extends RecordsRepo<Harvest> {
  protected readonly store: StoreName = 'harvests';

  /** Newest fruit first — the jar's and the pantry page's one ordering. */
  readonly newestFirst = computed(() =>
    [...this.all()].sort((a, b) => b.harvestedAt - a.harvestedAt || (a.id < b.id ? -1 : 1)),
  );

  /** «La conservería»: fruits still in the harvest jar (single-home law —
   *  sealed fruits live in their jam jar instead, never in both). */
  readonly fresh = computed(() => this.newestFirst().filter(isFresh));

  /**
   * Mint (or re-stamp) the fruit for a branch that just bloomed. Idempotent:
   * one row per branch forever; a re-achieve refreshes harvestedAt and the
   * snapshots (the row remembers the latest season). Returns null when the
   * bloom bears no fruit (a sendero pasito).
   */
  async recordBloom(
    node: TreeNode,
    tree: Tree,
    byId: ReadonlyMap<string, TreeNode>,
  ): Promise<Harvest | null> {
    if (underDailyPath(node, byId)) return null;
    const id = harvestIdFor(node.id);
    const existing = this.byId().get(id);
    const fields = {
      nodeId: node.id,
      treeId: tree.id,
      treeName: tree.name,
      accent: tree.accent,
      title: node.title,
      harvestedAt: node.achievedAt ?? Date.now(),
    };
    if (existing) {
      // Re-achieve (or a revived memory): lift any tombstone with the fresh
      // season — save() re-stamps rev/updatedAt for LWW.
      return this.save({ ...existing, ...fields, deletedAt: null });
    }
    return this.insert({ ...newSyncBase(), id, ...fields });
  }

  /**
   * One-time pantry reconstruction (v5 upgrade): every branch standing
   * bloomed when the jar arrives seeds its fruit, so a lived-in forest
   * wakes up with its harvest instead of an empty jar. Sendero pasitos
   * excluded (the law); tombstoned rows excluded (deleted things don't
   * reappear as fruit); archived branches/trees INCLUDED (the pantry keeps
   * what was folded away). Sealed by a meta sentinel — the idb.ts
   * `sealMigration` pattern; runs after load() so `all()` is warm.
   */
  async backfillIfNeeded(
    nodesById: ReadonlyMap<string, TreeNode>,
    treesById: ReadonlyMap<string, Tree>,
  ): Promise<void> {
    const SENTINEL = 'harvests.backfilledAt';
    try {
      const marker = await get<{ key: string }>('meta', SENTINEL);
      if (marker) return;
      const rows: Harvest[] = [];
      for (const node of nodesById.values()) {
        if (node.deletedAt || node.status !== 'achieved' || !node.achievedAt) continue;
        if (this.byId().has(harvestIdFor(node.id))) continue;
        const tree = treesById.get(node.treeId);
        if (!tree || tree.deletedAt) continue;
        if (underDailyPath(node, nodesById)) continue;
        rows.push({
          ...newSyncBase(),
          id: harvestIdFor(node.id),
          nodeId: node.id,
          treeId: tree.id,
          treeName: tree.name,
          accent: tree.accent,
          title: node.title,
          harvestedAt: node.achievedAt,
        });
      }
      if (rows.length) await this.saveMany(rows);
      await put('meta', { key: SENTINEL, at: Date.now(), seeded: rows.length });
    } catch {
      // Storage unavailable — retry next boot (sentinel not written).
    }
  }
}
