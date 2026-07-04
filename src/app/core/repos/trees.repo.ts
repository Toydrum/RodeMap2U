import { Injectable, computed } from '@angular/core';
import { AccentToken, Tree, newSyncBase } from '../db/schema';
import { StoreName } from '../db/idb';
import { RecordsRepo } from './records.repo';

@Injectable({ providedIn: 'root' })
export class TreesRepo extends RecordsRepo<Tree> {
  protected readonly store: StoreName = 'trees';

  readonly active = computed(() =>
    this.all()
      .filter((t) => !t.archivedAt)
      .sort((a, b) => a.order - b.order),
  );

  readonly archived = computed(() => this.all().filter((t) => t.archivedAt));

  /** Persist a user-arranged order (gap-numbered so future inserts stay easy). */
  async setOrder(ids: string[]): Promise<void> {
    const byId = this.byId();
    const updates: Tree[] = [];
    ids.forEach((id, index) => {
      const tree = byId.get(id);
      const order = (index + 1) * 10;
      if (tree && tree.order !== order) updates.push({ ...tree, order });
    });
    if (updates.length) await this.saveMany(updates);
  }

  async create(name: string, accent: AccentToken): Promise<Tree> {
    const maxOrder = Math.max(0, ...this.active().map((t) => t.order));
    const tree: Tree = {
      ...newSyncBase(),
      name,
      accent,
      order: maxOrder + 10,
      currentNodeId: null,
      archivedAt: null,
    };
    return this.insert(tree);
  }

  async rename(tree: Tree, name: string): Promise<void> {
    await this.save({ ...tree, name });
  }

  async setAccent(tree: Tree, accent: AccentToken): Promise<void> {
    await this.save({ ...tree, accent });
  }

  async setCurrentNode(tree: Tree, nodeId: string | null): Promise<void> {
    await this.save({ ...tree, currentNodeId: nodeId });
  }

  async archive(tree: Tree): Promise<void> {
    await this.save({ ...tree, archivedAt: Date.now() });
  }

  async restore(tree: Tree): Promise<void> {
    const current = this.byId().get(tree.id) ?? tree;
    if (!current.archivedAt) return;
    await this.save({ ...current, archivedAt: null });
  }
}
