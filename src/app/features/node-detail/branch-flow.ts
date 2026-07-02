import { Component, inject, input, output, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { NodesRepo } from '../../core/repos/nodes.repo';
import { TreesRepo } from '../../core/repos/trees.repo';
import { TreeNode } from '../../core/db/schema';
import { ToastService } from '../../shared/ui/toast.service';

/**
 * The transformation moment: a goal whose moment passed becomes a branch
 * point. Up to three alternative paths; one is enough. The original stays
 * in the tree, honored as part of the story.
 */
@Component({
  selector: 'app-branch-flow',
  templateUrl: './branch-flow.html',
  styleUrl: './branch-flow.scss',
})
export class BranchFlow {
  readonly node = input.required<TreeNode>();
  readonly closed = output<void>();

  protected readonly i18n = inject(I18nService);
  private readonly nodes = inject(NodesRepo);
  private readonly trees = inject(TreesRepo);
  private readonly toast = inject(ToastService);

  protected readonly alternatives = signal<string[]>(['']);

  protected setAlt(index: number, value: string): void {
    this.alternatives.update((alts) => alts.map((a, i) => (i === index ? value : a)));
  }

  protected addAlt(): void {
    if (this.alternatives().length < 3) this.alternatives.update((alts) => [...alts, '']);
  }

  protected valid(): boolean {
    return this.alternatives().some((a) => a.trim());
  }

  protected async confirm(): Promise<void> {
    const drafts = this.alternatives()
      .map((a) => a.trim())
      .filter(Boolean)
      .map((title) => ({ title }));
    if (!drafts.length) return;

    const children = await this.nodes.branch(this.node(), drafts);

    // "You are here" moves to the first new path.
    const tree = this.trees.byId().get(this.node().treeId);
    if (tree && children.length) await this.trees.setCurrentNode(tree, children[0].id);

    this.toast.show({ message: this.i18n.t().branchFlow.celebrate });
    this.closed.emit();
  }
}
