import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { TreesRepo } from '../../core/repos/trees.repo';
import { NodesRepo } from '../../core/repos/nodes.repo';
import { VisitSession } from '../../core/visit/visit-session';
import { MiniTree } from '../forest/mini-tree';

/**
 * The doorway into someone else's forest — deliberately thin (no drag, no
 * archive, no starters): a banner naming whose garden this is, and their
 * trees as cards. The real work happens inside a tree, where the whole
 * toolkit runs against the visit repos. Route-provided repos arrive via DI.
 */
@Component({
  selector: 'app-visit-forest',
  imports: [RouterLink, MiniTree],
  templateUrl: './visit-forest.html',
  styleUrl: './visit-forest.scss',
})
export class VisitForestPage {
  /** Route param via withComponentInputBinding. */
  readonly userId = input.required<string>();

  protected readonly i18n = inject(I18nService);
  protected readonly visit = inject(VisitSession);
  protected readonly trees = inject(TreesRepo);
  private readonly nodes = inject(NodesRepo);

  constructor() {
    // input() isn't set at construction time — read it from the route lazily.
    queueMicrotask(() => void this.visit.load(this.userId()));
  }

  protected readonly errorText = computed(() => {
    const code = this.visit.error();
    return code ? this.i18n.t().familia.errors[code] : '';
  });

  protected branchCountOf(treeId: string): number {
    return (this.nodes.byTree().get(treeId) ?? []).length;
  }
}
