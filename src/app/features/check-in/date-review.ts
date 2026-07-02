import { Component, computed, inject, input, output, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { NodesRepo } from '../../core/repos/nodes.repo';
import { TreeNode } from '../../core/db/schema';
import { BranchFlow } from '../node-detail/branch-flow';

/**
 * "Esta fecha ya pasó — ¿qué quieres hacer?"
 * Three shame-free exits per node: keep going (date released), move the date,
 * or open a new branch. Never red, never "overdue".
 */
@Component({
  selector: 'app-date-review',
  imports: [BranchFlow],
  templateUrl: './date-review.html',
  styleUrl: './date-review.scss',
})
export class DateReview {
  readonly nodesToReview = input.required<TreeNode[]>();
  readonly closed = output<void>();

  protected readonly i18n = inject(I18nService);
  private readonly nodes = inject(NodesRepo);

  protected readonly index = signal(0);
  protected readonly movingDate = signal(false);
  protected readonly branching = signal(false);

  protected readonly current = computed(() => this.nodesToReview()[this.index()] ?? null);

  private advance(): void {
    this.movingDate.set(false);
    this.branching.set(false);
    if (this.index() + 1 < this.nodesToReview().length) {
      this.index.update((i) => i + 1);
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
