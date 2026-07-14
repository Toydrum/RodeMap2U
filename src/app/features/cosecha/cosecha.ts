import { Component, computed, inject } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { HarvestsRepo } from '../../core/repos/harvests.repo';
import { NodesRepo } from '../../core/repos/nodes.repo';
import { Harvest } from '../../core/db/schema';
import { harvestMonths } from '../../core/harvest';
import { FruitSpec, fruitFor } from '../forest/flora';
import { FruitGlyph } from '../forest/fruit';
import { MeadowJar } from '../forest/jar';
import { HintChip } from '../../shared/ui/hint-chip';

interface HarvestRow {
  harvest: Harvest;
  spec: FruitSpec;
  /** «el 12 de julio» — a memory's date, never an elapsed-time age. */
  when: string;
  /** Door back to the branch — only while it still stands visible. */
  live: boolean;
}

interface MonthShelf {
  key: string;
  /** «julio» / «julio de 2025» once the year turns. */
  monthWord: string;
  rows: HarvestRow[];
}

/**
 * «La cosecha» — the pantry page: every fruit of every bloomed branch,
 * gathered by month, just for looking and savoring. THE PANTRY REGISTER
 * (schema.ts Harvest): memories survive reopen/archive/delete, while the
 * almanaque/meadow keep showing what stands — two registers, deliberate.
 * One modest lifetime count and nothing else numeric: never windowed,
 * never charted, never averaged. Fruits are never spendable.
 */
@Component({
  selector: 'app-cosecha',
  imports: [FruitGlyph, MeadowJar, HintChip],
  templateUrl: './cosecha.html',
  styleUrl: './cosecha.scss',
})
export class CosechaPage {
  protected readonly i18n = inject(I18nService);
  protected readonly harvests = inject(HarvestsRepo);
  private readonly nodes = inject(NodesRepo);
  private readonly location = inject(Location);
  private readonly router = inject(Router);

  protected readonly shelves = computed<MonthShelf[]>(() => {
    const locale = this.i18n.lang() === 'en' ? 'en' : 'es';
    const thisYear = new Date().getFullYear();
    return harvestMonths(this.harvests.all()).map((month) => {
      const [y, m] = month.key.split('-').map(Number);
      const sample = new Date(y, m - 1, 1);
      const monthWord =
        y === thisYear
          ? sample.toLocaleDateString(locale, { month: 'long' })
          : sample.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
      return {
        key: month.key,
        monthWord,
        rows: month.items.map((harvest) => {
          const node = this.nodes.byId().get(harvest.nodeId);
          return {
            harvest,
            spec: fruitFor(harvest.accent, harvest.treeId),
            when: new Date(harvest.harvestedAt).toLocaleDateString(locale, {
              day: 'numeric',
              month: 'long',
            }),
            live: !!node && !node.deletedAt && !node.archivedAt,
          };
        }),
      };
    });
  });

  protected readonly total = computed(() => this.harvests.all().length);

  /** Accent-washed tree chip — the almanaque's categorical recipe (14%,
   *  never count-scaled). */
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
