import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { CheckinsRepo } from '../../core/repos/checkins.repo';
import { NodesRepo } from '../../core/repos/nodes.repo';
import { TreesRepo } from '../../core/repos/trees.repo';
import { SettingsService } from '../../core/repos/settings.service';
import { Feeling, Tree, TreeNode } from '../../core/db/schema';
import { DateReview } from './date-review';
import { MiniTree } from '../forest/mini-tree';

const FEELINGS: { key: Feeling; emoji: string }[] = [
  { key: 'sunny', emoji: '☀️' },
  { key: 'calm', emoji: '🌤' },
  { key: 'foggy', emoji: '🌫' },
  { key: 'heavy', emoji: '🌧' },
  { key: 'stormy', emoji: '⛈' },
];

type Step = 'feeling' | 'where' | 'note' | 'review' | 'choose';

/** Past this many trees the circle interleaves two radii and shrinks. */
const RING_COMFORT = 9;

/**
 * The opening ritual: "¿Dónde sientes que estás?"
 * Two gentle questions and an optional note — skippable at every step,
 * no guilt attached. If any gentle dates have passed, they get one soft
 * conversation at the end.
 */
@Component({
  selector: 'app-check-in',
  imports: [DateReview, MiniTree],
  templateUrl: './check-in.html',
  styleUrl: './check-in.scss',
})
export class CheckInPage {
  protected readonly i18n = inject(I18nService);
  protected readonly nodes = inject(NodesRepo);
  protected readonly trees = inject(TreesRepo);
  protected readonly checkins = inject(CheckinsRepo);
  private readonly settings = inject(SettingsService);
  private readonly router = inject(Router);

  /** Express path taken — after a pending review, go straight to the meadow. */
  private readonly expressExit = signal(false);

  protected readonly feelings = FEELINGS;
  protected readonly step = signal<Step>('feeling');
  protected readonly feeling = signal<Feeling | null>(null);
  protected readonly whereNode = signal<TreeNode | null>(null);
  protected readonly note = signal('');

  /** Candidate "where I am" nodes: active ones, grouped by tree, capped. */
  protected readonly candidates = computed(() => {
    const result: { treeName: string; accent: string; node: TreeNode }[] = [];
    for (const tree of this.trees.active()) {
      const nodes = (this.nodes.byTree().get(tree.id) ?? [])
        .filter((n) => n.status === 'growing' || n.status === 'seed')
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 4);
      for (const node of nodes) {
        result.push({ treeName: tree.name, accent: tree.accent, node });
      }
    }
    return result.slice(0, 12);
  });

  /** Only dates from trees still standing in the forest — archived ones rest in peace. */
  protected readonly pendingReviews = computed(() => {
    const activeIds = new Set(this.trees.active().map((t) => t.id));
    return this.nodes.needsDateReview().filter((n) => activeIds.has(n.treeId));
  });

  /** The freshest little note — a letter your past self left for today. */
  protected readonly lastNote = computed(
    () =>
      [...this.checkins.all()]
        .sort((a, b) => b.createdAt - a.createdAt)
        .find((c) => c.note.trim().length > 0) ?? null,
  );

  protected lastNoteDate(): string {
    const letter = this.lastNote();
    if (!letter) return '';
    const locale = this.i18n.lang() === 'en' ? 'en' : 'es';
    return new Date(letter.createdAt).toLocaleDateString(locale, { day: 'numeric', month: 'long' });
  }

  protected pickFeeling(feeling: Feeling): void {
    this.feeling.set(feeling);
    this.step.set(this.candidates().length ? 'where' : 'note');
  }

  protected pickWhere(node: TreeNode | null): void {
    this.whereNode.set(node);
    this.step.set('note');
  }

  /** A mis-tap is not a commitment — steps walk back, choices stay. */
  protected stepBack(): void {
    const s = this.step();
    if (s === 'note') this.step.set(this.candidates().length ? 'where' : 'feeling');
    else if (s === 'where') this.step.set('feeling');
  }

  protected feelingEmoji(feeling: Feeling): string {
    return FEELINGS.find((f) => f.key === feeling)?.emoji ?? '';
  }

  /** One tap: same weather as last time, no note, no place. Pending
   *  date-reviews still get their word — then straight back to Ahora. */
  protected async expressCheckIn(): Promise<void> {
    const last = this.checkins.latest();
    if (!last) return;
    this.feeling.set(last.feeling);
    await this.checkins.record(last.feeling, { note: '' });
    await this.settings.patch({ lastCheckInAt: Date.now(), onboarded: true });
    if (this.pendingReviews().length) {
      this.expressExit.set(true);
      this.step.set('review');
    } else {
      void this.router.navigate(['/ahora']);
    }
  }

  protected async finish(): Promise<void> {
    const feeling = this.feeling();
    if (feeling) {
      await this.checkins.record(feeling, {
        note: this.note().trim(),
        treeId: this.whereNode()?.treeId ?? null,
        nodeId: this.whereNode()?.id ?? null,
      });
    }
    await this.settings.patch({ lastCheckInAt: Date.now(), onboarded: true });

    if (this.pendingReviews().length) {
      this.step.set('review');
    } else {
      this.leave();
    }
  }

  /** "Hoy no quiero responder" — always available, never penalized.
   *  Lands on Ahora: orientation without interrogation. */
  protected async skip(): Promise<void> {
    await this.settings.patch({ lastCheckInAt: Date.now(), onboarded: true });
    void this.router.navigate(['/ahora']);
  }

  /**
   * "Aquí estoy" earns a moment: if you already chose a branch, we go there;
   * otherwise your trees gather in a circle and you pick where to enter.
   * With an empty forest the button reads "plant my first tree" instead,
   * and lands with the planting sheet already open.
   */
  protected leave(): void {
    if (this.expressExit()) {
      void this.router.navigate(['/ahora']);
      return;
    }
    const where = this.whereNode();
    if (where) {
      void this.router.navigate(['/tree', where.treeId]);
    } else if (this.trees.active().length) {
      this.step.set('choose');
    } else {
      void this.router.navigate(['/forest'], { queryParams: { plant: 1 } });
    }
  }

  protected readonly ringCrowded = computed(() => this.trees.active().length > RING_COMFORT);

  /** Circular placement for the choose ritual. Past RING_COMFORT trees the
   *  circle becomes two interleaved petal rings (outer/inner) and the
   *  miniatures shrink — deterministic, viewport-safe up to ~20 trees. */
  protected ringTransform(index: number): string {
    const count = this.trees.active().length;
    const angle = (360 / Math.max(count, 1)) * index - 90;
    if (count <= RING_COMFORT) {
      return `rotate(${angle}deg) translateX(var(--ring-r)) rotate(${-angle}deg)`;
    }
    const radius = index % 2 === 0 ? 1.14 : 0.78;
    const scale = Math.max(0.6, Math.round((RING_COMFORT / count) * 100) / 100);
    return `rotate(${angle}deg) translateX(calc(var(--ring-r) * ${radius})) rotate(${-angle}deg) scale(${scale})`;
  }

  /** Entrance cascade, capped so a big forest doesn't feel like waiting. */
  protected enterDelay(index: number): string {
    return Math.min(index, 12) * 70 + 'ms';
  }

  protected enterTree(tree: Tree): void {
    void this.router.navigate(['/tree', tree.id]);
  }

  protected goForest(): void {
    void this.router.navigate(['/forest']);
  }
}
