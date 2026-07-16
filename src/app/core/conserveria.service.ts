import { Injectable, inject } from '@angular/core';
import { AccentToken, Harvest, JarVessel, Preserve, newSyncBase, stamp } from './db/schema';
import { StoreName, putAcross } from './db/idb';
import { broadcastChange } from './db/broadcast';
import { deriveAccent, isPending, jarCapacity, jarSizeFor } from './harvest';
import { HarvestsRepo } from './repos/harvests.repo';
import { PreservesRepo } from './repos/preserves.repo';

/** The flora-derived colors a seal needs — computed by the CALLER (the feature
 *  layer owns the palette; core stays feature-free, as in seal()). */
export interface SealTint {
  tint: string;
  tintEdge: string;
  accent: AccentToken | null;
}

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

  // ── «La promesa» (0.0.93): goal jars — an empty jar created ahead of its
  //    fruit, filled by placements, auto-sealed at capacity. ────────────────

  /** «La despedida» (0.0.95): distill a commemorative elixir when the user
   *  archives a fruited tree. It REFERENCES the tree (treeId) and carries «lo
   *  que me llevo» — it never moves the tree's fruits (no preserveId), so the
   *  register is untouched. Tint is precomputed by the caller (flora). */
  async distill(fields: {
    name: string;
    treeId: string;
    carry: string;
    accent: AccentToken | null;
    tint: string;
    tintEdge: string;
  }): Promise<Preserve> {
    const now = Date.now();
    const carry = fields.carry.trim();
    const preserve: Preserve = {
      ...newSyncBase(now),
      kind: 'elixir',
      name: fields.name.trim() || 'Despedida',
      madeAt: now,
      accent: fields.accent,
      tint: fields.tint,
      tintEdge: fields.tintEdge,
      openedAt: null,
      carry: carry || null,
      treeId: fields.treeId,
    };
    return this.preserves.insert(preserve);
  }

  /** Undo of a despedida (archive-undo window): tombstone the elixir. */
  async undistill(preserveId: string): Promise<void> {
    const jar = this.preserves.byId().get(preserveId);
    if (!jar || jar.deletedAt) return;
    await this.preserves.save({ ...jar, deletedAt: Date.now() });
  }

  /** Mint an EMPTY goal jar at the wizard: plannedAt = madeAt = now, sealedAt
   *  null, no members yet. `size` is the user's own valuation of their premio
   *  (the app never suggests it); capacity = jarCapacity(size). premio is
   *  required here (unlike pot jams). tint is a neutral placeholder from the
   *  caller — a pending jar shows its fruits, never a jam liquid. */
  async promise(fields: {
    name: string;
    size: JarVessel;
    premio: string;
    savedFor?: string | null;
    tint: string;
    tintEdge: string;
  }): Promise<Preserve> {
    const now = Date.now();
    const premio = fields.premio.trim();
    const preserve: Preserve = {
      ...newSyncBase(now),
      kind: 'mermelada',
      name: fields.name.trim() || 'Mi frasco',
      madeAt: now,
      accent: null,
      tint: fields.tint,
      tintEdge: fields.tintEdge,
      size: fields.size,
      premio: premio || null,
      savedFor: premio ? fields.savedFor?.trim() || null : null,
      openedAt: null,
      plannedAt: now,
      sealedAt: null,
    };
    return this.preserves.insert(preserve);
  }

  /** Place a fresh fruit into a pending goal jar (single-home: sets
   *  preserveId). Idempotent — refuses a fruit that already has a home or a
   *  jar that isn't a pending promise. When this placement reaches capacity,
   *  the jar auto-seals in the SAME transaction (`sealTint` precomputed by the
   *  caller). Returns { sealed:true } so the caller runs the modest
   *  celebration; the app never mints here — it only changes a fruit's home. */
  async place(
    harvestId: string,
    preserveId: string,
    sealTint: SealTint,
  ): Promise<{ jar: Preserve; fruit: Harvest; sealed: boolean } | null> {
    const h = this.harvests.byId().get(harvestId);
    const jar = this.preserves.byId().get(preserveId);
    if (!h || h.deletedAt || h.preserveId) return null;
    if (!jar || jar.deletedAt || jar.sealedAt || jar.plannedAt == null) return null;

    const placed = stamp({ ...h, preserveId: jar.id });
    const members = [...this.harvests.byId().values()].filter(
      (x) => x.preserveId === jar.id && !x.deletedAt && x.id !== placed.id,
    );
    members.push(placed);
    const willFill = members.length >= jarCapacity(jar.size ?? 'frasco');

    const entries: { store: StoreName; rows: unknown[] }[] = [
      { store: 'harvests', rows: [placed] },
    ];
    let sealedJar = jar;
    if (willFill) {
      const now = Date.now();
      sealedJar = stamp({
        ...jar,
        sealedAt: now,
        madeAt: now,
        accent: sealTint.accent,
        tint: sealTint.tint,
        tintEdge: sealTint.tintEdge,
      });
      entries.push({ store: 'preserves', rows: [sealedJar] });
    }
    await putAcross(entries);
    this.harvests.applyExternal(placed);
    broadcastChange({ store: 'harvests', ids: [placed.id] });
    if (willFill) {
      this.preserves.applyExternal(sealedJar);
      broadcastChange({ store: 'preserves', ids: [sealedJar.id] });
    }
    return { jar: sealedJar, fruit: placed, sealed: willFill };
  }

  /** Edit a pending goal jar's words (name/premio/savedFor) — editable while
   *  it fills, never after seal. premio never blanks (a promise IS its
   *  reward); savedFor is optional. */
  async editPromise(
    preserveId: string,
    fields: { name?: string; premio?: string; savedFor?: string },
  ): Promise<void> {
    const jar = this.preserves.byId().get(preserveId);
    if (!jar || jar.deletedAt || jar.sealedAt || jar.plannedAt == null) return;
    await this.preserves.save({
      ...jar,
      name: fields.name?.trim() || jar.name,
      premio: fields.premio?.trim() || jar.premio,
      savedFor: fields.savedFor?.trim() || null,
    });
  }

  /** Pull a fruit back out of a still-pending jar (re-placeable until seal).
   *  A sealed jam never gives a fruit back this way (seasons law). */
  async unplace(harvestId: string): Promise<void> {
    const h = this.harvests.byId().get(harvestId);
    if (!h || h.deletedAt || !h.preserveId) return;
    const jar = this.preserves.byId().get(h.preserveId);
    // Only a still-pending goal jar gives a fruit back; a sealed jam (or a pot
    // jam) is immutable. A missing jar = an orphan pointer, safe to clear.
    if (jar && (jar.deletedAt || !isPending(jar))) return;
    await this.harvests.save({ ...h, preserveId: null });
  }

  /** «Soltar» a pending goal jar: tombstone it and return every member to the
   *  fresh jar (same atomic shape as unseal). Only a pending promise can be
   *  released — a sealed jam is history. Always available (no lock, ever). */
  async release(preserve: Preserve): Promise<void> {
    const jar = this.preserves.byId().get(preserve.id) ?? preserve;
    if (jar.deletedAt || jar.sealedAt || jar.plannedAt == null) return;
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
    if (freed.length) broadcastChange({ store: 'harvests', ids: freed.map((r) => r.id) });
  }

  /** Undo of an auto-seal (toast window only): revert the jar to pending and
   *  return the triggering fruit to fresh — undoes the placement that filled
   *  it. Re-reads live records (never a captured copy — stale rev loses LWW);
   *  madeAt returns to plannedAt (deterministic from the record itself). */
  async unfill(preserveId: string, fruitId: string): Promise<void> {
    const jar = this.preserves.byId().get(preserveId);
    const fruit = this.harvests.byId().get(fruitId);
    if (!jar || jar.deletedAt || !jar.sealedAt || jar.plannedAt == null) return;
    const reopened = stamp({ ...jar, sealedAt: null, madeAt: jar.plannedAt });
    const entries: { store: StoreName; rows: unknown[] }[] = [
      { store: 'preserves', rows: [reopened] },
    ];
    let freed: Harvest | null = null;
    if (fruit && !fruit.deletedAt && fruit.preserveId === jar.id) {
      freed = stamp({ ...fruit, preserveId: null });
      entries.push({ store: 'harvests', rows: [freed] });
    }
    await putAcross(entries);
    this.preserves.applyExternal(reopened);
    broadcastChange({ store: 'preserves', ids: [reopened.id] });
    if (freed) {
      this.harvests.applyExternal(freed);
      broadcastChange({ store: 'harvests', ids: [freed.id] });
    }
  }

  /** Convergence safety net (never a user reward): seal a pending goal jar
   *  that is ALREADY at/over capacity — the rare multi-device case where two
   *  devices each placed the "last" fruit and neither sealed locally. Silent,
   *  ceremony-free, idempotent (guarded by sealedAt). Deterministic seal
   *  stamps (madeAt = the latest member's harvest, no `now`) so both devices
   *  converge by LWW. Changes the jar's HOME state; never mints fruit. */
  async reconcileSeal(preserveId: string, sealTint: SealTint): Promise<boolean> {
    const jar = this.preserves.byId().get(preserveId);
    if (!jar || jar.deletedAt || jar.sealedAt || jar.plannedAt == null) return false;
    const members = [...this.harvests.byId().values()].filter(
      (h) => h.preserveId === jar.id && !h.deletedAt,
    );
    if (members.length < jarCapacity(jar.size ?? 'frasco')) return false;
    const sealedAt = Math.max(...members.map((m) => m.harvestedAt));
    await this.preserves.save({
      ...jar,
      sealedAt,
      madeAt: sealedAt,
      accent: sealTint.accent,
      tint: sealTint.tint,
      tintEdge: sealTint.tintEdge,
    });
    return true;
  }
}
