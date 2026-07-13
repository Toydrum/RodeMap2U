import { Component, computed, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { TreesRepo } from '../../core/repos/trees.repo';
import { NodesRepo } from '../../core/repos/nodes.repo';
import { CheckinsRepo } from '../../core/repos/checkins.repo';
import { SettingsService } from '../../core/repos/settings.service';
import { ToastService, UNDO_MS } from '../../shared/ui/toast.service';
import { FEELING_EMOJI, Tree, TreeNode } from '../../core/db/schema';
import { dayOf, today } from '../../core/time';
import { hash } from '../forest/tree-layout';
import { FlowerSpec, flowerFor } from '../forest/flora';
import { FlowerGlyph } from '../forest/flower';
import { DateReview } from '../check-in/date-review';
import { SheetDirective } from '../../shared/ui/sheet.directive';
import { HintChip } from '../../shared/ui/hint-chip';
import {
  Caminito,
  DayMarks,
  caminitos,
  marksFor,
  monthMatrix,
  upcoming,
} from './almanac';

/** What one grid cell paints (at most two glyphs; the rest fold into (N)). */
interface CellGlyph {
  kind: 'flower' | 'knot' | 'capullo';
  spec: FlowerSpec;
}

/**
 * «El almanaque» — the forest seen through days. A TIME LENS over data
 * that already exists, sister of the tablita: it mirrors, it never
 * schedules and it never suggests (Ahora keeps that job). The past shows
 * only what grew; empty days are barbecho, never blanks in a scorecard.
 */
@Component({
  selector: 'app-almanaque',
  imports: [FlowerGlyph, DateReview, SheetDirective, HintChip],
  templateUrl: './almanaque.html',
  styleUrl: './almanaque.scss',
})
export class AlmanaquePage {
  protected readonly i18n = inject(I18nService);
  private readonly trees = inject(TreesRepo);
  private readonly nodes = inject(NodesRepo);
  private readonly checkins = inject(CheckinsRepo);
  private readonly settings = inject(SettingsService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  /* ------------------------------------------------------------- Hoy -- */

  protected readonly todayKey = computed(() => today());

  protected readonly todayLine = computed(() => {
    const locale = this.i18n.lang() === 'en' ? 'en' : 'es';
    const [y, m, d] = today().split('-').map(Number);
    const date = new Date(y, m - 1, d, 12).toLocaleDateString(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    return this.i18n.fill(this.i18n.t().almanaque.todayIs, { date });
  });

  protected readonly paths = computed<Caminito[]>(() =>
    caminitos(this.trees.active(), this.nodes.byTree()),
  );

  /** Today's chosen branches — silently empty once the date moves on. */
  protected readonly todayChips = computed<TreeNode[]>(() => {
    const intentions = this.settings.settings().todayIntentions;
    if (!intentions || intentions.date !== today()) return [];
    const activeIds = new Set(this.trees.active().map((t) => t.id));
    return intentions.nodeIds
      .map((id) => this.nodes.byId().get(id))
      .filter((n): n is TreeNode => !!n && !n.deletedAt && !n.archivedAt && activeIds.has(n.treeId));
  });

  protected readonly pendingReviews = computed(() => {
    const activeIds = new Set(this.trees.active().map((t) => t.id));
    return this.nodes.needsDateReview().filter((n) => activeIds.has(n.treeId));
  });

  protected readonly reviewing = signal(false);

  protected readonly upcomingDates = computed(() =>
    upcoming(this.trees.active(), this.nodes.byTree(), today()),
  );

  protected upcomingText(entry: { node: TreeNode; when: string }): string {
    const dict = this.i18n.t().almanaque;
    const when =
      entry.when === 'tomorrow'
        ? dict.whenTomorrow
        : entry.when === 'days'
          ? dict.whenDays
          : entry.when === 'week'
            ? dict.whenWeek
            : dict.whenLater;
    return this.i18n.fill(dict.upcomingLine, { title: entry.node.title, when });
  }

  protected readonly todayIsQuiet = computed(
    () =>
      !this.paths().length &&
      !this.todayChips().length &&
      !this.upcomingDates().length &&
      !this.pendingReviews().length,
  );

  /** Bloom the «siguiente» stone right on the path — same verb as the tree,
   *  with the undo law (re-read the LIVE record; never re-save a capture). */
  protected async bloomStone(step: TreeNode): Promise<void> {
    const prevStatus = step.status;
    await this.nodes.setStatus(step, 'achieved');
    this.toast.show(
      {
        message: this.i18n.fill(this.i18n.t().almanaque.stoneBloomed, { title: step.title }),
        actionLabel: this.i18n.t().common.undo,
        action: () => {
          const fresh = this.nodes.byId().get(step.id);
          if (fresh && !fresh.deletedAt && fresh.status === 'achieved') {
            void this.nodes.setStatus(fresh, prevStatus);
          }
        },
      },
      UNDO_MS,
    );
  }

  /* ------------------------------------------------------------- Mes -- */

  private readonly viewYear = signal(Number(today().slice(0, 4)));
  private readonly viewMonth = signal(Number(today().slice(5, 7)));

  protected readonly weeks = computed(() =>
    monthMatrix(this.viewYear(), this.viewMonth(), this.i18n.lang() === 'en' ? 0 : 1),
  );

  protected readonly monthLabel = computed(() => {
    const locale = this.i18n.lang() === 'en' ? 'en' : 'es';
    const label = new Date(this.viewYear(), this.viewMonth() - 1, 1, 12).toLocaleDateString(locale, {
      month: 'long',
      year: 'numeric',
    });
    return label.charAt(0).toUpperCase() + label.slice(1);
  });

  protected readonly weekdayNames = computed(() => {
    const locale = this.i18n.lang() === 'en' ? 'en' : 'es';
    const start = this.i18n.lang() === 'en' ? 0 : 1;
    // A known week: 2026-06-01 was a Monday; day 7 = Sunday.
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(2026, 5, 1 + ((start + i + 6) % 7), 12);
      return day.toLocaleDateString(locale, { weekday: 'narrow' });
    });
  });

  protected readonly marks = computed(() =>
    marksFor(this.trees.active(), this.nodes.byTree(), this.checkins.all(), today()),
  );

  protected readonly viewingToday = computed(
    () =>
      this.viewYear() === Number(today().slice(0, 4)) &&
      this.viewMonth() === Number(today().slice(5, 7)),
  );

  protected prevMonth(): void {
    if (this.viewMonth() === 1) {
      this.viewMonth.set(12);
      this.viewYear.update((y) => y - 1);
    } else {
      this.viewMonth.update((m) => m - 1);
    }
  }

  protected nextMonth(): void {
    if (this.viewMonth() === 12) {
      this.viewMonth.set(1);
      this.viewYear.update((y) => y + 1);
    } else {
      this.viewMonth.update((m) => m + 1);
    }
  }

  protected backToToday(): void {
    this.viewYear.set(Number(today().slice(0, 4)));
    this.viewMonth.set(Number(today().slice(5, 7)));
  }

  /* ------------------------------------------------- cell rendering -- */

  protected dayNum(date: string): number {
    return Number(date.slice(8, 10));
  }

  /** Deterministic soil-plot wobble — same day, same little shape, forever. */
  protected wobble(date: string): string {
    const h = hash(date);
    const r = (shift: number) => 6 + ((h >> shift) % 7);
    return `${r(0)}px ${r(3)}px ${r(6)}px ${r(9)}px`;
  }

  /** At most two glyphs per cell: flowers > knots > capullos. */
  protected cellGlyphs(m: DayMarks): CellGlyph[] {
    const glyphs: CellGlyph[] = [
      ...m.flowers.map((f) => ({ kind: 'flower' as const, spec: this.specOf(f.tree) })),
      ...m.knots.map((k) => ({ kind: 'knot' as const, spec: this.specOf(k.tree) })),
      ...m.capullos.map((c) => ({ kind: 'capullo' as const, spec: this.specOf(c.tree) })),
    ];
    return glyphs.slice(0, 2);
  }

  protected overflowCount(m: DayMarks): number {
    return Math.max(0, m.flowers.length + m.knots.length + m.capullos.length - 2);
  }

  protected hasPassedDate(m: DayMarks): boolean {
    return m.capullos.some((c) => c.passed);
  }

  private readonly specCache = new Map<string, FlowerSpec>();

  protected specOf(tree: Tree): FlowerSpec {
    let spec = this.specCache.get(tree.id);
    if (!spec) {
      spec = flowerFor(tree.accent, tree.id);
      this.specCache.set(tree.id, spec);
    }
    return spec;
  }

  /** Arrow keys walk the grid — roving focus, calm and predictable. */
  protected onGridKey(event: KeyboardEvent): void {
    const deltas: Record<string, number> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: 7,
      ArrowUp: -7,
    };
    const delta = deltas[event.key];
    if (!delta) return;
    const cells = Array.from(
      (event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('.alm-cell'),
    );
    const index = cells.indexOf(event.target as HTMLButtonElement);
    if (index === -1) return;
    const next = cells[index + delta];
    if (next) {
      event.preventDefault();
      next.focus();
    }
  }

  /* -------------------------------------------------- day page sheet -- */

  protected readonly openDate = signal<string | null>(null);

  protected readonly openMarks = computed<DayMarks | null>(() => {
    const date = this.openDate();
    if (!date) return null;
    return (
      this.marks().get(date) ?? { capullos: [], flowers: [], knots: [], hasCheckin: false }
    );
  });

  protected readonly openDateLine = computed(() => {
    const date = this.openDate();
    if (!date) return '';
    const locale = this.i18n.lang() === 'en' ? 'en' : 'es';
    const [y, m, d] = date.split('-').map(Number);
    return new Date(y, m - 1, d, 12).toLocaleDateString(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  });

  /** That day's footprints — feeling + notita, trail-style, day-scoped. */
  protected readonly openFootprints = computed(() => {
    const date = this.openDate();
    if (!date) return [];
    const dict = this.i18n.t();
    return this.checkins
      .all()
      .filter((c) => dayOf(c.createdAt) === date)
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((c) => ({
        emoji: FEELING_EMOJI[c.feeling],
        feelingName: dict.checkIn.feelings[c.feeling],
        note: c.note.trim(),
      }));
  });

  protected readonly openIsPast = computed(() => (this.openDate() ?? '') < today());
  protected readonly openIsToday = computed(() => this.openDate() === today());

  protected readonly openIsEmpty = computed(() => {
    const m = this.openMarks();
    return (
      !!m && !m.capullos.length && !m.flowers.length && !m.knots.length && !this.openFootprints().length
    );
  });

  protected openDay(date: string): void {
    this.openDate.set(date);
  }

  protected closeDay(): void {
    this.openDate.set(null);
  }

  protected treeOf(node: TreeNode): Tree | undefined {
    return this.trees.byId().get(node.treeId);
  }

  /** Every deep tap lands on the tree — the almanac never replaces it. */
  protected openBranch(node: TreeNode): void {
    this.openDate.set(null);
    void this.router.navigate(['/tree', node.treeId], { queryParams: { node: node.id } });
  }

  protected goBack(): void {
    if (history.length > 1) {
      this.location.back();
    } else {
      void this.router.navigate(['/forest']);
    }
  }
}
