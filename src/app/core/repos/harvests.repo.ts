import { Injectable, computed, inject } from '@angular/core';
import { Harvest, Tree, TreeNode, harvestIdFor, newSyncBase } from '../db/schema';
import { StoreName, get, put } from '../db/idb';
import { RecordsRepo } from './records.repo';
import { isFresh, isPending, underDailyPath } from '../harvest';
import { PreservesRepo } from './preserves.repo';

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

  /** «La promesa» (0.0.93): recordBloom consults preserves to tell a fruit in
   *  a still-PENDING goal jar (mutable — re-stamps in place) from one SEALED
   *  into a jam (immutable history — re-achieving mints a new season). No
   *  cycle: preserves.repo.ts never imports harvests. */
  private readonly preserves = inject(PreservesRepo);

  /** Newest fruit first — the jar's and the pantry page's one ordering. */
  readonly newestFirst = computed(() =>
    [...this.all()].sort((a, b) => b.harvestedAt - a.harvestedAt || (a.id < b.id ? -1 : 1)),
  );

  /** «La conservería»: fruits still in the harvest jar (single-home law —
   *  sealed fruits live in their jam jar instead, never in both). */
  readonly fresh = computed(() => this.newestFirst().filter(isFresh));

  /**
   * Mint the fruit for a branch that just bloomed. Returns null when the
   * bloom bears no fruit (a sendero pasito).
   *
   * Season law (0.0.91 «segunda cosecha»): a FRESH existing row re-stamps
   * in place (one usable fruit per branch — toggling never farms); a row
   * SEALED into a jam is HISTORY and is never touched (sealed jams are
   * immutable — «se conserva siempre»): the re-achieve mints a NEW season
   * row ('h:'+nodeId+':s2', ':s3'…) into the fresh jar instead. The
   * register accumulates both honestly — used fruits stay locked in their
   * jams, new work bears new fruit. Season ids are deterministic from the
   * row count, so two devices re-achieving concurrently converge by LWW.
   *
   * «La promesa» (0.0.93) amends who is re-stampable: a fruit placed in a
   * still-PENDING goal jar is NOT history (its jar hasn't sealed), so it
   * re-stamps in place too — only a SEALED home makes a row immutable.
   */
  async recordBloom(
    node: TreeNode,
    tree: Tree,
    byId: ReadonlyMap<string, TreeNode>,
  ): Promise<Harvest | null> {
    if (underDailyPath(node, byId)) return null;
    const fields = {
      nodeId: node.id,
      treeId: tree.id,
      treeName: tree.name,
      accent: tree.accent,
      title: node.title,
      harvestedAt: node.achievedAt ?? Date.now(),
    };
    // The branch's current usable fruit, if any. Re-stampable = fresh, OR
    // placed in a goal jar that hasn't sealed yet (a pending promise is not
    // immutable history — only a sealed jam is).
    const rows = [...this.byId().values()].filter(
      (h) => h.nodeId === node.id && !h.deletedAt,
    );
    let target = rows.find((h) => !h.preserveId);
    if (!target) {
      target = rows.find((h) => {
        const jar = h.preserveId ? this.preserves.byId().get(h.preserveId) : null;
        // A goal jar still filling is mutable; a SEALED jam (or a pot jam,
        // which has no plannedAt) is immutable history — isPending gates both.
        return !!jar && !jar.deletedAt && isPending(jar);
      });
    }
    if (target) {
      return this.save({ ...target, ...fields, deletedAt: null });
    }
    if (!rows.length) {
      return this.insert({ ...newSyncBase(), id: harvestIdFor(node.id), ...fields });
    }
    // Every earlier fruit is sealed away — a new season begins. Bounded
    // probe keeps the id deterministic even after odd sync merges.
    let season = rows.length + 1;
    let id = harvestIdFor(node.id) + ':s' + season;
    while (this.byId().has(id) && season < rows.length + 50) {
      season++;
      id = harvestIdFor(node.id) + ':s' + season;
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
