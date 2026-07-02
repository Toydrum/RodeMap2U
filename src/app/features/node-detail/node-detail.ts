import { Component, computed, inject, input, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { NodesRepo } from '../../core/repos/nodes.repo';
import { TreesRepo } from '../../core/repos/trees.repo';
import { SessionsRepo } from '../../core/repos/sessions.repo';
import { NodeStatus, Tree, TreeNode } from '../../core/db/schema';
import { isPast } from '../../core/time';
import { BranchFlow } from './branch-flow';

const SELECTABLE_STATUSES: NodeStatus[] = ['seed', 'growing', 'resting', 'achieved'];

@Component({
  selector: 'app-node-detail',
  imports: [BranchFlow],
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

  protected readonly statuses = SELECTABLE_STATUSES;
  protected readonly branching = signal(false);
  protected readonly stepTitle = signal('');

  protected readonly children = computed(() => this.nodes.childrenOf(this.node()));
  protected readonly datePassed = computed(() => {
    const date = this.node().targetDate;
    return date !== null && isPast(date) && this.node().status !== 'achieved' && this.node().status !== 'branched';
  });
  protected readonly focusMinutes = computed(() => this.sessions.totalMinutesFor(this.node().id));
  protected readonly isCurrent = computed(() => this.tree().currentNodeId === this.node().id);

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
  }

  protected async setHere(): Promise<void> {
    await this.trees.setCurrentNode(this.tree(), this.node().id);
  }

  protected focusHere(): void {
    void this.router.navigate(['/timer'], { queryParams: { node: this.node().id } });
  }

  protected async archive(): Promise<void> {
    await this.nodes.archiveSubtree(this.node());
    this.closed.emit();
  }

  protected plantedOn(): string {
    return new Date(this.node().createdAt).toLocaleDateString(this.i18n.lang() === 'es' ? 'es-MX' : 'en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }
}
