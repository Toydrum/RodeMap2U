import { Injectable, inject } from '@angular/core';
import { Harvest, Preserve, newSyncBase, stamp } from './db/schema';
import { putAcross } from './db/idb';
import { broadcastChange } from './db/broadcast';
import { deriveAccent, jarSizeFor } from './harvest';
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
   * The vessel is a seal-time snapshot (jarSizeFor over the REAL member
   * count); premio/savedFor are the user's own words, stored verbatim.
   * Returns the sealed jar, or null if nothing was left to seal.
   */
  async seal(
    memberIds: string[],
    jar: {
      name: string;
      tint: string;
      tintEdge: string;
      premio?: string | null;
      savedFor?: string | null;
    },
  ): Promise<Preserve | null> {
    const members = memberIds
      .map((id) => this.harvests.byId().get(id))
      .filter((h): h is Harvest => !!h && !h.deletedAt && !h.preserveId);
    if (!members.length) return null;

    const premio = jar.premio?.trim() || null;
    const preserve: Preserve = {
      ...newSyncBase(),
      kind: 'mermelada',
      name: jar.name.trim() || 'Mermelada',
      madeAt: Date.now(),
      accent: deriveAccent(members),
      tint: jar.tint,
      tintEdge: jar.tintEdge,
      size: jarSizeFor(members.length),
      premio,
      savedFor: premio ? jar.savedFor?.trim() || null : null,
      openedAt: null,
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

  /**
   * «Abrir la mermelada» (0.0.90) — the claiming ceremony's one write:
   * stamp openedAt on the LIVE record. No member rows move (nothing
   * changes home — what is consumed is the real-world permission). The
   * app never locks a jar; this is always the user's own moment.
   */
  async open(preserve: Preserve): Promise<Preserve | null> {
    const live = this.preserves.byId().get(preserve.id);
    if (!live || live.deletedAt || live.openedAt) return null;
    return this.preserves.save({ ...live, openedAt: Date.now() });
  }

  /** The opening's undo (toast window only): re-read live, null the stamp. */
  async reclose(preserve: Preserve): Promise<void> {
    const live = this.preserves.byId().get(preserve.id);
    if (!live || live.deletedAt || !live.openedAt) return;
    await this.preserves.save({ ...live, openedAt: null });
  }

  /** The seal's undo (toast window only): tombstone the jar, return
   *  every live member to the fresh jar. Same atomic shape as seal.
   *  An OPENED jar never unseals — its story moved on (the seal toast can
   *  outlive a whole claiming ceremony; each undo acts only on its own
   *  moment). */
  async unseal(preserve: Preserve): Promise<void> {
    const jar = this.preserves.byId().get(preserve.id) ?? preserve;
    if (jar.deletedAt || jar.openedAt) return;
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
