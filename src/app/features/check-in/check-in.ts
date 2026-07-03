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
  private readonly checkins = inject(CheckinsRepo);
  private readonly settings = inject(SettingsService);
  private readonly router = inject(Router);

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

  protected pickFeeling(feeling: Feeling): void {
    this.feeling.set(feeling);
    this.step.set(this.candidates().length ? 'where' : 'note');
  }

  protected pickWhere(node: TreeNode | null): void {
    this.whereNode.set(node);
    this.step.set('note');
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

  /** "Hoy no quiero responder" — always available, never penalized. */
  protected async skip(): Promise<void> {
    await this.settings.patch({ lastCheckInAt: Date.now(), onboarded: true });
    void this.router.navigate(['/forest']);
  }

  /**
   * "Aquí estoy" earns a moment: if you already chose a branch, we go there;
   * otherwise your trees gather in a circle and you pick where to enter.
   * With an empty forest the button reads "plant my first tree" instead,
   * and lands with the planting sheet already open.
   */
  protected leave(): void {
    const where = this.whereNode();
    if (where) {
      void this.router.navigate(['/tree', where.treeId]);
    } else if (this.trees.active().length) {
      this.step.set('choose');
    } else {
      void this.router.navigate(['/forest'], { queryParams: { plant: 1 } });
    }
  }

  /** Circular placement for the choose ritual. */
  protected ringTransform(index: number): string {
    const count = this.trees.active().length;
    const angle = (360 / Math.max(count, 1)) * index - 90;
    return `rotate(${angle}deg) translateX(var(--ring-r)) rotate(${-angle}deg)`;
  }

  protected enterTree(tree: Tree): void {
    void this.router.navigate(['/tree', tree.id]);
  }

  protected goForest(): void {
    void this.router.navigate(['/forest']);
  }
}
