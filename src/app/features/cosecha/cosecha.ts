import { Component, computed, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { HarvestsRepo } from '../../core/repos/harvests.repo';
import { PreservesRepo } from '../../core/repos/preserves.repo';
import { NodesRepo } from '../../core/repos/nodes.repo';
import { ConserveriaService } from '../../core/conserveria.service';
import { ToastService, UNDO_MS } from '../../shared/ui/toast.service';
import { Harvest, Preserve } from '../../core/db/schema';
import { harvestMonths, isSealedJam, membersOf } from '../../core/harvest';
import { FruitSpec, fruitFor } from '../forest/flora';
import { FruitGlyph } from '../forest/fruit';
import { MeadowJar } from '../forest/jar';
import { JamJar } from '../forest/jam-jar';
import { PromiseJar } from '../forest/promise-jar';
import { HintChip } from '../../shared/ui/hint-chip';
import { ConfirmSheet } from '../../shared/ui/confirm-sheet';
import { inputValue } from '../../shared/ui/dom';
import { MermeladaSheet } from './mermelada-sheet';
import { TeSheet } from './te-sheet';
import { AbrirMermeladaSheet } from './abrir-mermelada-sheet';
import { PromesaSheet } from './promesa-sheet';
import { PromiseService } from './promise.service';

interface HarvestRow {
  harvest: Harvest;
  spec: FruitSpec;
  /** «el 12 de julio» — a memory's date, never an elapsed-time age. */
  when: string;
  /** Door back to the branch — only while it still stands visible. */
  live: boolean;
  /** The jar this fruit lives in (single-home made visible), or null. */
  jarName: string | null;
}

interface JamShelfItem {
  preserve: Preserve;
  monthWord: string;
}

/**
 * «La conservería» (0.0.89) — the pantry page: the fresh jar, the alacena
 * of sealed jams, the té door, and the month REGISTER (every fruit forever,
 * jammed or not — the lifetime count can never decrease; monotonicity is
 * the visible proof that nothing is ever spent). Master law: nada se
 * gasta; todo se conserva.
 */
@Component({
  selector: 'app-cosecha',
  imports: [
    FruitGlyph,
    MeadowJar,
    JamJar,
    PromiseJar,
    HintChip,
    ConfirmSheet,
    MermeladaSheet,
    TeSheet,
    AbrirMermeladaSheet,
    PromesaSheet,
  ],
  templateUrl: './cosecha.html',
  styleUrl: './cosecha.scss',
})
export class CosechaPage {
  protected readonly inputValue = inputValue;
  protected readonly i18n = inject(I18nService);
  protected readonly harvests = inject(HarvestsRepo);
  protected readonly preserves = inject(PreservesRepo);
  protected readonly promise = inject(PromiseService);
  private readonly nodes = inject(NodesRepo);
  private readonly conserveria = inject(ConserveriaService);
  private readonly toast = inject(ToastService);
  private readonly location = inject(Location);
  private readonly router = inject(Router);

  /** Ritual doors — @defer'd sheets; DOORS CANCEL applies to all. */
  protected readonly makingJam = signal(false);
  protected readonly brewingTea = signal(false);
  /** «La promesa» wizard door. */
  protected readonly promising = signal(false);
  /** The claiming ceremony's jar («abrir la mermelada»), or null. */
  protected readonly claiming = signal<Preserve | null>(null);
  /** The alacena's inline disclosure (almanaque day-page pattern). */
  protected readonly openJarId = signal<string | null>(null);
  /** The pending goal jar's inline detail (separate panel from the alacena's). */
  protected readonly openPendingId = signal<string | null>(null);
  /** Within the open pending detail: the add-fruit tray + the edit form. */
  protected readonly addOpen = signal(false);
  protected readonly editOpen = signal(false);
  protected readonly editName = signal('');
  protected readonly editPremio = signal('');
  protected readonly editSavedFor = signal('');
  /** The pending jar awaiting a «soltar» confirm, or null. */
  protected readonly releasing = signal<Preserve | null>(null);

  private monthWordOf(epochMs: number): string {
    const locale = this.i18n.lang() === 'en' ? 'en' : 'es';
    const d = new Date(epochMs);
    const thisYear = new Date().getFullYear();
    return d.getFullYear() === thisYear
      ? d.toLocaleDateString(locale, { month: 'long' })
      : d.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  }

  private rowOf(harvest: Harvest): HarvestRow {
    const locale = this.i18n.lang() === 'en' ? 'en' : 'es';
    const node = this.nodes.byId().get(harvest.nodeId);
    const jar = harvest.preserveId ? this.preserves.byId().get(harvest.preserveId) : undefined;
    return {
      harvest,
      spec: fruitFor(harvest.accent, harvest.treeId),
      when: new Date(harvest.harvestedAt).toLocaleDateString(locale, {
        day: 'numeric',
        month: 'long',
      }),
      live: !!node && !node.deletedAt && !node.archivedAt,
      jarName: jar && !jar.deletedAt ? jar.name : null,
    };
  }

  /** The REGISTER: month shelves over every fruit, whatever its home. */
  protected readonly shelves = computed(() =>
    harvestMonths(this.harvests.all()).map((month) => {
      const [y, m] = month.key.split('-').map(Number);
      return {
        key: month.key,
        monthWord: this.monthWordOf(new Date(y, m - 1, 1).getTime()),
        rows: month.items.map((h) => this.rowOf(h)),
      };
    }),
  );

  private shelfItemOf(preserve: Preserve): JamShelfItem {
    return { preserve, monthWord: this.monthWordOf(preserve.madeAt) };
  }

  /** The alacena: SEALED jars only (0.0.92 — the shelf of what waits),
   *  chronological — never a species grid. Pending goal jars (0.0.93) have
   *  their own shelf, so isSealedJam keeps them out of here. */
  protected readonly jamShelf = computed<JamShelfItem[]>(() =>
    this.preserves
      .newestFirst()
      .filter((p) => isSealedJam(p) && !p.openedAt)
      .map((p) => this.shelfItemOf(p)),
  );

  /** «Las disfrutadas» (0.0.92): opened jars move HERE — history, never
   *  deletion (nada se gasta): still tappable, memories forever, newest
   *  enjoyment first, never counted. */
  protected readonly enjoyedShelf = computed<JamShelfItem[]>(() =>
    this.preserves
      .newestFirst()
      .filter((p) => !!p.openedAt)
      .sort((a, b) => (b.openedAt ?? 0) - (a.openedAt ?? 0) || (a.id < b.id ? -1 : 1))
      .map((p) => this.shelfItemOf(p)),
  );

  /** The open jar's member fruits (single-home, provably nothing lost). */
  protected readonly openJarRows = computed(() => {
    const id = this.openJarId();
    if (!id) return [];
    return membersOf(id, this.harvests.all()).map((h) => this.rowOf(h));
  });

  /** Panel lookup across BOTH shelves (the selected jar may live on either). */
  protected readonly openJar = computed(() => {
    const id = this.openJarId();
    if (!id) return null;
    const preserve = this.preserves.byId().get(id);
    return preserve && !preserve.deletedAt ? this.shelfItemOf(preserve) : null;
  });

  /** True when the selected jar belongs to the enjoyed shelf — the panel
   *  renders beside the shelf its jar lives on. */
  protected readonly openJarEnjoyed = computed(() => !!this.openJar()?.preserve.openedAt);

  /** Lifetime register count — ALL fruits; it can never decrease. */
  protected readonly total = computed(() => this.harvests.all().length);

  protected toggleJar(id: string): void {
    this.openJarId.set(this.openJarId() === id ? null : id);
  }

  protected onJarEscape(): void {
    if (this.openPendingId()) {
      this.openPendingId.set(null);
      return;
    }
    if (this.openJarId()) this.openJarId.set(null);
  }

  // ── «La promesa» (0.0.93): goal jars ─────────────────────────────────────

  /** The open pending jar (still pending — auto-seal closes the panel). */
  protected readonly openPending = computed(() => {
    const id = this.openPendingId();
    if (!id) return null;
    return this.promise.pending().find((p) => p.id === id) ?? null;
  });

  /** The open pending jar's placed fruits, as rows (newest first). */
  protected readonly openPendingMembers = computed(() => {
    const jar = this.openPending();
    if (!jar) return [];
    return membersOf(jar.id, this.harvests.all()).map((h) => this.rowOf(h));
  });

  /** Fresh fruits available to store into the open jar (the add tray). */
  protected readonly freshRows = computed(() => this.harvests.fresh().map((h) => this.rowOf(h)));

  /** The ONE forward-facing count line — lives ONLY here, on the jar's own
   *  detail panel (owner carve-out to «la app es la alacena…»). */
  protected pendingFillLine(preserve: Preserve): string {
    const have = this.promise.membersOf(preserve.id).length;
    const cap = this.promise.capacity(preserve.size);
    const dict = this.i18n.t().cosecha.promise.fillLine;
    return this.i18n.fill(have === 1 ? dict.one : dict.many, { count: have, cap });
  }

  protected premioAtFill(preserve: Preserve): string {
    return this.i18n.fill(this.i18n.t().cosecha.promise.premioAtFill, { premio: preserve.premio ?? '' });
  }

  protected togglePending(id: string): void {
    const next = this.openPendingId() === id ? null : id;
    this.openPendingId.set(next);
    this.addOpen.set(false);
    this.editOpen.set(false);
  }

  protected openWizard(): void {
    if (this.promise.atLimit()) return;
    this.promising.set(true);
  }

  /** Wizard sealed a new promise: close it and open its detail so the user
   *  sees the empty jar waiting for its first fruit. */
  protected onPromiseCreated(preserve: Preserve): void {
    this.promising.set(false);
    this.openPendingId.set(preserve.id);
  }

  protected addFruit(harvestId: string): void {
    const jar = this.openPending();
    if (!jar) return;
    void this.promise.placeAndCelebrate(harvestId, jar.id);
    // A seal closes the panel (jar leaves pending); otherwise keep filling.
    if (!this.harvests.fresh().length) this.addOpen.set(false);
  }

  protected removeFruit(harvestId: string): void {
    void this.promise.unplace(harvestId);
  }

  protected startEdit(preserve: Preserve): void {
    this.editName.set(preserve.name);
    this.editPremio.set(preserve.premio ?? '');
    this.editSavedFor.set(preserve.savedFor ?? '');
    this.editOpen.set(true);
  }

  protected saveEdit(): void {
    const jar = this.openPending();
    if (!jar) return;
    void this.promise.edit(jar.id, {
      name: this.editName(),
      premio: this.editPremio(),
      savedFor: this.editSavedFor(),
    });
    this.editOpen.set(false);
  }

  protected askRelease(preserve: Preserve): void {
    this.releasing.set(preserve);
  }

  protected doRelease(): void {
    const jar = this.releasing();
    if (!jar) return;
    void this.promise.release(jar);
    this.releasing.set(null);
    if (this.openPendingId() === jar.id) this.openPendingId.set(null);
    this.toast.show({ message: this.i18n.t().cosecha.promise.released }, UNDO_MS);
  }

  /** Seal landed: close the ritual, offer the one undo window («abrir»
   *  belongs to the ceremony now — undo says Deshacer, everywhere). */
  protected onSealed(preserve: Preserve): void {
    this.makingJam.set(false);
    this.toast.show(
      {
        message: this.i18n.t().cosecha.jamMadeToast,
        actionLabel: this.i18n.t().common.undo,
        action: () => void this.conserveria.unseal(preserve),
      },
      UNDO_MS,
    );
  }

  /** Claim landed: the jar stands «disfrutada»; one undo window. */
  protected onOpened(preserve: Preserve): void {
    this.claiming.set(null);
    this.toast.show(
      {
        message: this.i18n.t().cosecha.openedToast,
        actionLabel: this.i18n.t().common.undo,
        action: () => void this.conserveria.reclose(preserve),
      },
      UNDO_MS,
    );
  }

  protected enjoyedLine(preserve: Preserve): string {
    const locale = this.i18n.lang() === 'en' ? 'en' : 'es';
    const date = new Date(preserve.openedAt ?? 0).toLocaleDateString(locale, {
      day: 'numeric',
      month: 'long',
    });
    return this.i18n.fill(this.i18n.t().cosecha.enjoyedOn, { date });
  }

  /** Accent-washed tree chip — the almanaque's categorical recipe. */
  protected chipWash(row: HarvestRow): string {
    return `color-mix(in srgb, var(--accent-${row.harvest.accent}) 14%, var(--surface))`;
  }

  protected chipBorder(row: HarvestRow): string {
    return `color-mix(in srgb, var(--accent-${row.harvest.accent}) 32%, transparent)`;
  }

  /** Reread in place — the Trail's door: the branch on its own tree. */
  protected openBranch(row: HarvestRow): void {
    if (!row.live) return;
    void this.router.navigate(['/tree', row.harvest.treeId], {
      queryParams: { node: row.harvest.nodeId },
    });
  }

  protected goBack(): void {
    if (history.length > 1) {
      this.location.back();
    } else {
      void this.router.navigate(['/forest']);
    }
  }
}
