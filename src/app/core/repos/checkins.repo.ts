import { Injectable, computed, inject } from '@angular/core';
import { CheckIn, Feeling, newSyncBase } from '../db/schema';
import { StoreName } from '../db/idb';
import { RecordsRepo } from './records.repo';
import { TreesRepo } from './trees.repo';

@Injectable({ providedIn: 'root' })
export class CheckinsRepo extends RecordsRepo<CheckIn> {
  protected readonly store: StoreName = 'checkins';
  private readonly trees = inject(TreesRepo);

  readonly latest = computed(() =>
    [...this.all()].sort((a, b) => b.createdAt - a.createdAt).at(0) ?? null,
  );

  async record(feeling: Feeling, opts: { note?: string; treeId?: string | null; nodeId?: string | null } = {}): Promise<CheckIn> {
    const checkIn: CheckIn = {
      ...newSyncBase(),
      feeling,
      note: opts.note ?? '',
      treeId: opts.treeId ?? null,
      nodeId: opts.nodeId ?? null,
    };
    const saved = await this.insert(checkIn);
    // "Where I am" moves with the check-in.
    if (opts.treeId && opts.nodeId) {
      const tree = this.trees.byId().get(opts.treeId);
      if (tree) await this.trees.setCurrentNode(tree, opts.nodeId);
    }
    return saved;
  }
}
