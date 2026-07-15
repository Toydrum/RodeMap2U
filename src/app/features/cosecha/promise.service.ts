import { Injectable, computed, inject, signal } from '@angular/core';
import { Harvest, JarVessel, Preserve } from '../../core/db/schema';
import { ConserveriaService, SealTint } from '../../core/conserveria.service';
import { HarvestsRepo } from '../../core/repos/harvests.repo';
import { PreservesRepo } from '../../core/repos/preserves.repo';
import { deriveAccent, jarCapacity } from '../../core/harvest';
import { jamTint } from '../forest/flora';
import { I18nService } from '../../core/i18n/i18n.service';
import { ToastService, UNDO_MS } from '../../shared/ui/toast.service';

/**
 * «La promesa» (0.0.93) — the goal-jar feature service. It owns the palette
 * (flora's jamTint) so core stays feature-free: the caller computes every seal
 * tint and hands it to ConserveriaService. It also enforces the ≤3 pending
 * limit and runs the convergence reconcile (boot + post-sync).
 *
 * Two jar families now share the Preserve store: frascos de la olla (size from
 * the fruit, past-facing — the mermelada ritual) vs frascos prometidos (size =
 * the user's OWN valuation of their premio; the app never suggests reward↔size).
 */

/** The upper bound on goal jars filling at once — a small, focused shelf of
 *  promises (same spirit as «ramas de hoy ≤3»). */
export const MAX_PENDING_PROMISES = 3;

/** A pending jar shows its fruits, never a jam liquid, so its stored tint is
 *  only a neutral placeholder until the seal recomputes the real blend. */
const NEUTRAL_TINT = '#d9d2c4';
const NEUTRAL_TINT_EDGE = '#b7ad99';

@Injectable({ providedIn: 'root' })
export class PromiseService {
  private readonly conserveria = inject(ConserveriaService);
  private readonly harvests = inject(HarvestsRepo);
  private readonly preserves = inject(PreservesRepo);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);

  /** Goal jars still filling, newest promise first. */
  readonly pending = this.preserves.pending;
  readonly atLimit = computed(() => this.pending().length >= MAX_PENDING_PROMISES);

  /** A fresh fruit awaiting a jar choice — set by the bloom toast when >1 jar
   *  is pending; a cross-page picker host (mounted in App) reads it. */
  readonly placementRequest = signal<Harvest | null>(null);
  requestPlacement(h: Harvest): void {
    this.placementRequest.set(h);
  }
  clearPlacement(): void {
    this.placementRequest.set(null);
  }

  /** Live members of a jar (the fruits placed so far). */
  membersOf(preserveId: string): Harvest[] {
    return [...this.harvests.byId().values()].filter(
      (h) => h.preserveId === preserveId && !h.deletedAt,
    );
  }

  capacity(size: JarVessel | undefined): number {
    return jarCapacity(size ?? 'frasco');
  }

  /** Create an empty goal jar from the wizard (refused past the limit). */
  create(fields: {
    name: string;
    size: JarVessel;
    premio: string;
    savedFor?: string | null;
  }): Promise<Preserve | null> {
    if (this.atLimit()) return Promise.resolve(null);
    return this.conserveria.promise({
      ...fields,
      tint: NEUTRAL_TINT,
      tintEdge: NEUTRAL_TINT_EDGE,
    });
  }

  /** The seal color a member set WOULD blend to (flora lives here, not core). */
  private sealTintFor(members: Harvest[]): SealTint {
    return { accent: deriveAccent(members), ...jamTint(members.map((m) => m.accent)) };
  }

  /** Place a fresh fruit into a pending jar; auto-seals at capacity. Returns
   *  the place() result. */
  place(harvestId: string, preserveId: string) {
    const jar = this.preserves.byId().get(preserveId);
    const h = this.harvests.byId().get(harvestId);
    if (!jar || !h) return Promise.resolve(null);
    const prospective = this.membersOf(preserveId).filter((x) => x.id !== h.id);
    prospective.push(h);
    return this.conserveria.place(harvestId, preserveId, this.sealTintFor(prospective));
  }

  /** Place a fruit and, if that placement fills the jar, run the ONE modest
   *  auto-seal celebration (a toast with Undo — the big rain is reserved for
   *  opening). Centralized so every entry point (manual /cosecha, the bloom
   *  toast, the picker) celebrates identically. */
  async placeAndCelebrate(harvestId: string, preserveId: string): Promise<void> {
    const res = await this.place(harvestId, preserveId);
    if (!res?.sealed) return;
    this.toast.show(
      {
        message: this.i18n.fill(this.i18n.t().cosecha.promise.autoSealToast, { name: res.jar.name }),
        actionLabel: this.i18n.t().common.undo,
        action: () => void this.unfill(res.jar.id, res.fruit.id),
      },
      UNDO_MS,
    );
  }

  unplace(harvestId: string) {
    return this.conserveria.unplace(harvestId);
  }

  edit(preserveId: string, fields: { name?: string; premio?: string; savedFor?: string }) {
    return this.conserveria.editPromise(preserveId, fields);
  }

  release(preserve: Preserve) {
    return this.conserveria.release(preserve);
  }

  /** Undo an auto-seal: back to pending + the triggering fruit back to fresh. */
  unfill(preserveId: string, fruitId: string) {
    return this.conserveria.unfill(preserveId, fruitId);
  }

  /** Convergence: seal any pending jar already at capacity (multi-device edge
   *  where neither device sealed locally). Silent + ceremony-free — called at
   *  boot and after every sync pull, never on the local place() path (which
   *  already sealed). */
  async reconcile(): Promise<void> {
    for (const jar of this.preserves.pending()) {
      const members = this.membersOf(jar.id);
      if (members.length >= this.capacity(jar.size)) {
        await this.conserveria.reconcileSeal(jar.id, this.sealTintFor(members));
      }
    }
  }
}
