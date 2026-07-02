import { computed, signal } from '@angular/core';
import { SyncBase, stamp } from '../db/schema';
import { StoreName, get, getAll, put, putMany } from '../db/idb';
import { broadcastChange } from '../db/broadcast';

/**
 * Base signal repository: load-once into a Map signal, write-through on
 * mutation (disk first, then memory — IDB puts are ~1 ms, and the ordering
 * removes the "memory says X, disk says Y" bug class entirely).
 */
export abstract class RecordsRepo<T extends SyncBase> {
  protected abstract readonly store: StoreName;

  private readonly records = signal<ReadonlyMap<string, T>>(new Map());

  /** Live records — tombstones filtered here and nowhere else. */
  readonly all = computed(() => [...this.records().values()].filter((r) => !r.deletedAt));

  readonly byId = computed(() => this.records());

  async load(): Promise<void> {
    try {
      const rows = await getAll<T>(this.store);
      this.records.set(new Map(rows.map((r) => [r.id, r])));
    } catch {
      // Storage unavailable — start empty, run the session in memory.
      this.records.set(new Map());
    }
  }

  /** Persist a new or updated record (stamps rev/updatedAt). */
  async save(record: T): Promise<T> {
    const stamped = stamp(record);
    await this.persist(() => put(this.store, stamped));
    this.applyLocal(stamped);
    broadcastChange({ store: this.store, ids: [stamped.id] });
    return stamped;
  }

  /** Persist a brand-new record as-is (already carries rev 1). */
  async insert(record: T): Promise<T> {
    await this.persist(() => put(this.store, record));
    this.applyLocal(record);
    broadcastChange({ store: this.store, ids: [record.id] });
    return record;
  }

  /** Atomic multi-record write (single IDB transaction). */
  async saveMany(records: T[]): Promise<void> {
    await this.persist(() => putMany(this.store, records));
    for (const record of records) this.applyLocal(record);
    broadcastChange({ store: this.store, ids: records.map((r) => r.id) });
  }

  /** Disk first; if storage is unavailable, keep working in memory. */
  private async persist(write: () => Promise<void>): Promise<void> {
    try {
      await write();
    } catch {
      /* memory-only session */
    }
  }

  /** Sync tombstone — the record stays forever, filtered from `all`. */
  async tombstone(record: T): Promise<void> {
    await this.save({ ...record, deletedAt: Date.now() });
  }

  /** Re-read specific ids from disk and apply if newer (cross-tab / future sync). */
  async refreshFromDisk(ids: string[]): Promise<void> {
    for (const id of ids) {
      const fresh = await get<T>(this.store, id);
      if (fresh) this.applyExternal(fresh);
    }
  }

  /** Accept an externally-produced record iff it is newer (rev LWW). */
  applyExternal(record: T): void {
    const current = this.records().get(record.id);
    if (current && current.rev >= record.rev) return;
    this.applyLocal(record);
  }

  /** Replace the whole in-memory set (import-replace path). */
  resetTo(records: T[]): void {
    this.records.set(new Map(records.map((r) => [r.id, r])));
  }

  protected applyLocal(record: T): void {
    this.records.update((map) => {
      const next = new Map(map);
      next.set(record.id, record);
      return next;
    });
  }
}
