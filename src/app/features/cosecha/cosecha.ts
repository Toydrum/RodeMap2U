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
import { harvestMonths, membersOf } from '../../core/harvest';
import { FruitSpec, fruitFor } from '../forest/flora';
import { FruitGlyph } from '../forest/fruit';
import { MeadowJar } from '../forest/jar';
import { JamJar } from '../forest/jam-jar';
import { HintChip } from '../../shared/ui/hint-chip';
import { MermeladaSheet } from './mermelada-sheet';
import { TeSheet } from './te-sheet';
import { AbrirMermeladaSheet } from './abrir-mermelada-sheet';

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
  imports: [FruitGlyph, MeadowJar, JamJar, HintChip, MermeladaSheet, TeSheet, AbrirMermeladaSheet],
  templateUrl: './cosecha.html',
  styleUrl: './cosecha.scss',
})
export class CosechaPage {
  protected readonly i18n = inject(I18nService);
  protected readonly harvests = inject(HarvestsRepo);
  protected readonly preserves = inject(PreservesRepo);
  private readonly nodes = inject(NodesRepo);
  private readonly conserveria = inject(ConserveriaService);
  private readonly toast = inject(ToastService);
  private readonly location = inject(Location);
  private readonly router = inject(Router);

  /** Ritual doors — @defer'd sheets; DOORS CANCEL applies to all. */
  protected readonly makingJam = signal(false);
  protected readonly brewingTea = signal(false);
  /** The claiming ceremony's jar («abrir la mermelada»), or null. */
  protected readonly claiming = signal<Preserve | null>(null);
  /** The alacena's inline disclosure (almanaque day-page pattern). */
  protected readonly openJarId = signal<string | null>(null);

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

  /** The alacena: sealed jars, chronological — never a species grid. */
  protected readonly jamShelf = computed<JamShelfItem[]>(() =>
    this.preserves.newestFirst().map((preserve) => ({
      preserve,
      monthWord: this.monthWordOf(preserve.madeAt),
    })),
  );

  /** The open jar's member fruits (single-home, provably nothing lost). */
  protected readonly openJarRows = computed(() => {
    const id = this.openJarId();
    if (!id) return [];
    return membersOf(id, this.harvests.all()).map((h) => this.rowOf(h));
  });

  protected readonly openJar = computed(() => {
    const id = this.openJarId();
    return id ? this.jamShelf().find((j) => j.preserve.id === id) ?? null : null;
  });

  /** Lifetime register count — ALL fruits; it can never decrease. */
  protected readonly total = computed(() => this.harvests.all().length);

  protected toggleJar(id: string): void {
    this.openJarId.set(this.openJarId() === id ? null : id);
  }

  protected onJarEscape(): void {
    if (this.openJarId()) this.openJarId.set(null);
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
