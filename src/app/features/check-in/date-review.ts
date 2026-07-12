import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { NodesRepo } from '../../core/repos/nodes.repo';
import { TreeNode } from '../../core/db/schema';
import { BranchFlow } from '../node-detail/branch-flow';
import { SheetDirective } from '../../shared/ui/sheet.directive';

/**
 * "Esta fecha ya pasó — ¿qué quieres hacer?"
 * Three shame-free exits per node: keep going (date released), move the date,
 * or open a new branch. Never red, never "overdue".
 */
@Component({
  selector: 'app-date-review',
  imports: [BranchFlow, SheetDirective],
  templateUrl: './date-review.html',
  styleUrl: './date-review.scss',
})
export class DateReview implements OnInit {
  readonly nodesToReview = input.required<TreeNode[]>();
  readonly closed = output<void>();

  protected readonly i18n = inject(I18nService);
  private readonly nodes = inject(NodesRepo);

  /** The queue is SNAPSHOTTED at open: the parent passes a live computed
   *  that shrinks the moment a node is resolved, and walking a shrinking
   *  array by index skipped every other node (resolve A → [B,C] + index 1
   *  → C shown, B never reviewed). Ids are fixed here; the card itself
   *  reads the LIVE record so edits still show. */
  private queue: string[] = [];
  protected readonly index = signal(0);
  protected readonly movingDate = signal(false);
  protected readonly branching = signal(false);

  ngOnInit(): void {
    this.queue = this.nodesToReview().map((n) => n.id);
  }

  protected readonly current = computed(() => {
    const id = this.queue[this.index()];
    if (!id) return null;
    const node = this.nodes.byId().get(id);
    return node && !node.archivedAt && !node.deletedAt ? node : null;
  });

  private advance(): void {
    this.movingDate.set(false);
    this.branching.set(false);
    // Walk the snapshot; skip nodes another tab resolved or archived while
    // this conversation was open.
    let next = this.index() + 1;
    while (next < this.queue.length) {
      const node = this.nodes.byId().get(this.queue[next]);
      if (node && !node.archivedAt && !node.deletedAt && node.targetDate) break;
      next++;
    }
    if (next < this.queue.length) {
      this.index.set(next);
    } else {
      this.closed.emit();
    }
  }

  protected async keepGoing(): Promise<void> {
    const node = this.current();
    if (node) await this.nodes.update(node, { targetDate: null });
    this.advance();
  }

  protected async moveDate(value: string): Promise<void> {
    const node = this.current();
    if (node && value) await this.nodes.update(node, { targetDate: value });
    this.advance();
  }

  protected onBranched(): void {
    this.advance();
  }

  protected later(): void {
    this.closed.emit();
  }
}
