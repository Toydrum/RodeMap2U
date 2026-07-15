import { Injectable, inject } from '@angular/core';
import { Harvest, Preserve, newSyncBase, stamp } from './db/schema';
import { putAcross } from './db/idb';
import { broadcastChange } from './db/broadcast';
import { deriveAccent } from './harvest';
import { HarvestsRepo } from './repos/harvests.repo';
import { PreservesRepo } from './repos/preserves.repo';

/**
 * «La conservería» (0.0.89) — the seal/unseal orchestrator. THE master law:
 * nada se gasta; todo se conserva. Sealing changes each member fruit's HOME
 * (preserveId), never its existence — one atomic transaction across both
 * stores (putAcross), because a batch row without its members (or members
 * pointing at no batch) must be impossible. Unseal exists ONLY for the undo
 * toast window; afterwards, preserves don't un-cook. Tints/names are
 * computed by the CALLER (the ritual sheet owns flora's colors — core stays
 * feature-free); this service owns records, stamps and broadcasts.
 */
@Injectable({ providedIn: 'root' })
export class ConserveriaService {
  private readonly harvests = inject(HarvestsRepo);
  private readonly preserves = inject(PreservesRepo);

  /**
   * Seal a batch: mint the Preserve + stamp every member's home in ONE
   * transaction. Members are re-read live (never captured rows — stale rev
   * loses LWW) and already-preserved fruits are skipped (idempotence).
   * Returns the sealed jar, or null if nothing was left to seal.
   */
  async seal(
    memberIds: string[],
    jar: { name: string; tint: string; tintEdge: string },
  ): Promise<Preserve | null> {
    const members = memberIds
      .map((id) => this.harvests.byId().get(id))
      .filter((h): h is Harvest => !!h && !h.deletedAt && !h.preserveId);
    if (!members.length) return null;

    const preserve: Preserve = {
      ...newSyncBase(),
      kind: 'mermelada',
      name: jar.name.trim() || 'Mermelada',
      madeAt: Date.now(),
      accent: deriveAccent(members),
      tint: jar.tint,
      tintEdge: jar.tintEdge,
    };
    // stamp() BEFORE the write — raw multi-store puts don't stamp for you
    // (the setOrder scar).
    const stamped = members.map((m) => stamp({ ...m, preserveId: preserve.id }));
    await putAcross([
      { store: 'preserves', rows: [preserve] },
      { store: 'harvests', rows: stamped },
    ]);
    this.preserves.applyExternal(preserve);
    for (const row of stamped) this.harvests.applyExternal(row);
    broadcastChange({ store: 'preserves', ids: [preserve.id] });
    broadcastChange({ store: 'harvests', ids: stamped.map((r) => r.id) });
    return preserve;
  }

  /** «Abrir el frasco» — the undo-window unseal: tombstone the jar, return
   *  every live member to the fresh jar. Same atomic shape as seal. */
  async unseal(preserve: Preserve): Promise<void> {
    const jar = this.preserves.byId().get(preserve.id) ?? preserve;
    if (jar.deletedAt) return;
    const tombstoned = stamp({ ...jar, deletedAt: Date.now() });
    const freed = [...this.harvests.byId().values()]
      .filter((h) => h.preserveId === jar.id && !h.deletedAt)
      .map((h) => stamp({ ...h, preserveId: null }));
    await putAcross([
      { store: 'preserves', rows: [tombstoned] },
      { store: 'harvests', rows: freed },
    ]);
    this.preserves.applyExternal(tombstoned);
    for (const row of freed) this.harvests.applyExternal(row);
    broadcastChange({ store: 'preserves', ids: [tombstoned.id] });
    broadcastChange({ store: 'harvests', ids: freed.map((r) => r.id) });
  }
}
