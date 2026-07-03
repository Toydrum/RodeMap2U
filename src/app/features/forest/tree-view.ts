import { Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { TreesRepo } from '../../core/repos/trees.repo';
import { NodesRepo } from '../../core/repos/nodes.repo';
import { ToastService } from '../../shared/ui/toast.service';
import { CheckinsRepo } from '../../core/repos/checkins.repo';
import { Feeling, TreeNode } from '../../core/db/schema';
import { TreeCanvas } from './tree-canvas';
import { SceneBackdrop } from './scene-backdrop';
import { NodeDetail } from '../node-detail/node-detail';
import { DateReview } from '../check-in/date-review';

@Component({
  selector: 'app-tree-view',
  imports: [RouterLink, TreeCanvas, SceneBackdrop, NodeDetail, DateReview],
  templateUrl: './tree-view.html',
  styleUrl: './tree-view.scss',
})
export class TreeViewPage {
  /** Route param via withComponentInputBinding. */
  readonly id = input.required<string>();

  protected readonly i18n = inject(I18nService);
  protected readonly trees = inject(TreesRepo);
  protected readonly nodes = inject(NodesRepo);
  private readonly router = inject(Router);

  protected readonly tree = computed(() => this.trees.byId().get(this.id()) ?? null);

  private readonly checkins = inject(CheckinsRepo);
  private readonly moodOverride = new URLSearchParams(location.search).get('mood') as Feeling | null;
  protected readonly mood = computed<Feeling | null>(
    () => this.moodOverride ?? this.checkins.latest()?.feeling ?? null,
  );

  protected readonly openNode = signal<TreeNode | null>(null);
  /** null = closed; { parent: null } = plant a root; { parent: node } = plant under it. */
  protected readonly planting = signal<{ parent: TreeNode | null } | null>(null);
  protected readonly reviewing = signal(false);
  protected readonly archiving = signal(false);
  protected readonly newTitle = signal('');
  private readonly toast = inject(ToastService);

  /** Dates on THIS tree wanting a word. */
  protected readonly pendingReviews = computed(() =>
    this.nodes.needsDateReview().filter((n) => n.treeId === this.id()),
  );

  protected readonly branchCount = computed(() => (this.nodes.byTree().get(this.id()) ?? []).length);
  protected readonly bloomCount = computed(
    () => (this.nodes.byTree().get(this.id()) ?? []).filter((n) => n.status === 'achieved').length,
  );

  protected onNodeOpened(node: TreeNode): void {
    this.openNode.set(node);
  }

  /** Keep the sheet showing the live version of the node. */
  protected readonly liveOpenNode = computed(() => {
    const open = this.openNode();
    if (!open) return null;
    return (this.nodes.byId().get(open.id) as TreeNode | undefined) ?? null;
  });

  protected plantSheetTitle(): string {
    const target = this.planting();
    if (target?.parent) {
      return this.i18n.fill(this.i18n.t().node.plantUnder, { title: target.parent.title });
    }
    return this.i18n.t().node.newTitle;
  }

  protected async plant(): Promise<void> {
    const tree = this.tree();
    const target = this.planting();
    const title = this.newTitle().trim();
    if (!tree || !target || !title) return;
    const node = await this.nodes.plant(tree.id, target.parent?.id ?? null, { title });
    if (!tree.currentNodeId) await this.trees.setCurrentNode(tree, node.id);
    this.newTitle.set('');
    this.planting.set(null);
  }

  protected notFoundGoHome(): void {
    void this.router.navigate(['/forest']);
  }

  /** "Delete" the compass way: the tree rests in the archive, recoverable. */
  protected async archiveTree(): Promise<void> {
    const tree = this.tree();
    if (!tree) return;
    await this.trees.archive(tree);
    this.archiving.set(false);
    this.toast.show({
      message: this.i18n.fill(this.i18n.t().tree.archivedToast, { name: tree.name }),
    });
    void this.router.navigate(['/forest']);
  }
}
