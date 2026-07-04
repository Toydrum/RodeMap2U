import { Component, ElementRef, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { NodesRepo } from '../../core/repos/nodes.repo';
import { TreesRepo } from '../../core/repos/trees.repo';
import { SessionsRepo } from '../../core/repos/sessions.repo';
import { NodeStatus, Tree, TreeNode } from '../../core/db/schema';
import { isPast } from '../../core/time';
import { ToastService, UNDO_MS } from '../../shared/ui/toast.service';
import { BranchFlow } from './branch-flow';
import { SheetDirective } from '../../shared/ui/sheet.directive';

const SELECTABLE_STATUSES: NodeStatus[] = ['seed', 'growing', 'resting', 'achieved'];

@Component({
  selector: 'app-node-detail',
  imports: [BranchFlow, SheetDirective],
  templateUrl: './node-detail.html',
  styleUrl: './node-detail.scss',
})
export class NodeDetail {
  readonly node = input.required<TreeNode>();
  readonly tree = input.required<Tree>();
  readonly closed = output<void>();

  protected readonly i18n = inject(I18nService);
  protected readonly nodes = inject(NodesRepo);
  protected readonly trees = inject(TreesRepo);
  protected readonly sessions = inject(SessionsRepo);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly statuses = SELECTABLE_STATUSES;
  protected readonly branching = signal(false);
  protected readonly stepTitle = signal('');
  private readonly stepInput = viewChild<ElementRef<HTMLInputElement>>('stepInput');
  /** Archiving takes the whole subtree with it — always ask first. */
  protected readonly confirmingArchive = signal(false);
  protected readonly confirmingRevert = signal(false);

  /** Every branch that would rest along with this one (self excluded). */
  protected readonly descendantCount = computed(() => {
    let count = 0;
    const queue = [...this.nodes.childrenOf(this.node())];
    while (queue.length) {
      const child = queue.pop()!;
      count++;
      queue.push(...this.nodes.childrenOf(child));
    }
    return count;
  });

  protected readonly children = computed(() => this.nodes.childrenOf(this.node()));
  protected readonly datePassed = computed(() => {
    const date = this.node().targetDate;
    return date !== null && isPast(date) && this.node().status !== 'achieved' && this.node().status !== 'branched';
  });
  protected readonly focusMinutes = computed(() => this.sessions.totalMinutesFor(this.node().id));
  protected readonly isCurrent = computed(() => this.tree().currentNodeId === this.node().id);

  /** Branch-born children still blank soil — revert stays honest. Once any
   *  alternative is touched, the transformation took root and this hides. */
  protected readonly revertable = computed(() => {
    const node = this.node();
    if (node.status !== 'branched') return false;
    return this.nodes
      .childrenOf(node)
      .filter((c) => c.origin === 'branch')
      .every(
        (c) =>
          c.status === 'seed' &&
          !c.note.trim() &&
          c.targetDate === null &&
          this.nodes.childrenOf(c).length === 0 &&
          !this.sessions.all().some((s) => s.nodeId === c.id),
      );
  });

  protected async setTitle(title: string): Promise<void> {
    const trimmed = title.trim();
    if (trimmed && trimmed !== this.node().title) {
      await this.nodes.update(this.node(), { title: trimmed });
    }
  }

  protected async setNote(note: string): Promise<void> {
    if (note !== this.node().note) await this.nodes.update(this.node(), { note });
  }

  protected async setDate(value: string): Promise<void> {
    await this.nodes.update(this.node(), { targetDate: value || null });
  }

  protected async setStatus(status: NodeStatus): Promise<void> {
    if (status !== this.node().status) await this.nodes.setStatus(this.node(), status);
  }

  protected async addStep(): Promise<void> {
    const title = this.stepTitle().trim();
    if (!title) return;
    await this.nodes.plant(this.node().treeId, this.node().id, { title });
    this.stepTitle.set('');
    // Clicking the + button steals focus — hand it back for the next step.
    this.stepInput()?.nativeElement.focus();
  }

  /** Blooming a pasito is an unambiguous "done!" — celebrate it and offer
   *  to plant the next tiny step right at the dopamine peak. */
  protected async bloomStep(child: TreeNode): Promise<void> {
    await this.nodes.setStatus(child, 'achieved');
    this.toast.show({
      message: this.i18n.fill(this.i18n.t().ahora.bloomToast, { title: child.title }),
      actionLabel: this.i18n.t().ahora.bloomMore,
      action: () => this.stepInput()?.nativeElement.focus(),
    });
  }

  protected async setHere(): Promise<void> {
    await this.trees.setCurrentNode(this.tree(), this.node().id);
  }

  protected focusHere(): void {
    void this.router.navigate(['/timer'], { queryParams: { node: this.node().id } });
  }

  protected async archive(): Promise<void> {
    const node = this.node();
    const archived = await this.nodes.archiveSubtree(node);
    this.confirmingArchive.set(false);
    this.toast.show(
      {
        message: this.i18n.fill(this.i18n.t().node.archivedToast, { title: node.title }),
        actionLabel: this.i18n.t().common.undo,
        action: () => void this.nodes.unarchiveMany(archived),
      },
      UNDO_MS,
    );
    this.closed.emit();
  }

  /** Undo of an unrooted branching — the only way out of 'branched'. */
  protected async revertBranch(): Promise<void> {
    const node = this.node();
    const removed = await this.nodes.revertBranch(node);
    if (removed.some((c) => c.id === this.tree().currentNodeId)) {
      await this.trees.setCurrentNode(this.tree(), node.id);
    }
    this.confirmingRevert.set(false);
    this.toast.show({ message: this.i18n.t().node.revertedToast });
  }

  protected plantedOn(): string {
    return new Date(this.node().createdAt).toLocaleDateString(this.i18n.lang() === 'es' ? 'es-MX' : 'en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }
}
