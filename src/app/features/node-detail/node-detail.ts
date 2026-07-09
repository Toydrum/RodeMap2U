import { Component, ElementRef, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { NodesRepo } from '../../core/repos/nodes.repo';
import { TreesRepo } from '../../core/repos/trees.repo';
import { SessionsRepo } from '../../core/repos/sessions.repo';
import { NodePriority, NodeStatus, Tree, TreeNode } from '../../core/db/schema';
import { isPast } from '../../core/time';
import { ToastService, UNDO_MS } from '../../shared/ui/toast.service';
import { BranchFlow } from './branch-flow';
import { SheetDirective } from '../../shared/ui/sheet.directive';
import { VisitSession } from '../../core/visit/visit-session';

const SELECTABLE_STATUSES: NodeStatus[] = ['seed', 'growing', 'resting', 'achieved'];

/** UI positions of the «luz» picker — 'steady' is the unstored default. */
export type LightChoice = 'sunlit' | 'steady' | 'shade';
const LIGHTS: LightChoice[] = ['sunlit', 'steady', 'shade'];
const LIGHT_ICONS: Record<LightChoice, string> = { sunlit: '☀️', steady: '🌿', shade: '🌳' };

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
  protected readonly lights = LIGHTS;
  protected readonly lightIcons = LIGHT_ICONS;
  /** Sessions are the visitor's own — never offered inside someone else's forest. */
  protected readonly visiting = inject(VisitSession, { optional: true }) !== null;
  protected readonly branching = signal(false);
  protected readonly stepTitle = signal('');
  /** Briefly spotlights the next step after a bloom ("¿Siguiente paso?"). */
  protected readonly highlightId = signal<string | null>(null);
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

  /** 'steps' = the pasitos are an ordered path (paso 1 → paso 2 → …). */
  protected readonly flowSteps = computed(() => this.node().flow === 'steps');

  /** The earliest still-open step — "→ siguiente" on the ordered list. */
  protected readonly nextStepId = computed(
    () => this.children().find((c) => c.status === 'seed' || c.status === 'growing')?.id ?? null,
  );
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

  protected async setTrigger(value: string): Promise<void> {
    const trigger = value.trim() || null;
    if (trigger !== (this.node().trigger ?? null)) {
      await this.nodes.update(this.node(), { trigger });
    }
  }

  protected async setStatus(status: NodeStatus): Promise<void> {
    if (status !== this.node().status) await this.nodes.setStatus(this.node(), status);
  }

  /** «La luz» lives only on live branches (seed/growing) — a stale value on
   *  an achieved/resting record persists silently and stays inert. */
  protected readonly currentLight = computed<LightChoice>(() => {
    const p = this.node().priority;
    return p === 'sunlit' || p === 'shade' ? p : 'steady';
  });

  protected async setLight(light: LightChoice): Promise<void> {
    if (light === this.currentLight()) return;
    const priority: NodePriority | null = light === 'steady' ? null : light;
    await this.nodes.update(this.node(), { priority });
  }

  protected async addStep(): Promise<void> {
    const title = this.stepTitle().trim();
    if (!title) return;
    await this.nodes.plant(this.node().treeId, this.node().id, { title });
    this.stepTitle.set('');
    // Clicking the + button steals focus — hand it back for the next step.
    this.stepInput()?.nativeElement.focus();
  }

  /** The pasitos become (or stop being) an ordered path. Never forced. */
  protected async toggleFlow(): Promise<void> {
    await this.nodes.update(this.node(), { flow: this.flowSteps() ? 'free' : 'steps' });
  }

  protected async moveStep(child: TreeNode, dir: -1 | 1): Promise<void> {
    await this.nodes.moveStep(child, dir);
  }

  /** Blooming a pasito is an unambiguous "done!" — celebrate it and offer
   *  the next move right at the dopamine peak: on an ordered path that is
   *  the NEXT step; otherwise, planting another tiny one. */
  protected async bloomStep(child: TreeNode): Promise<void> {
    await this.nodes.setStatus(child, 'achieved');
    const next = this.flowSteps()
      ? this.children().find((c) => c.status === 'seed' || c.status === 'growing')
      : null;
    this.toast.show({
      message: this.i18n.fill(this.i18n.t().ahora.bloomToast, { title: child.title }),
      actionLabel: next ? this.i18n.t().node.nextStepAction : this.i18n.t().ahora.bloomMore,
      action: () => {
        if (next) {
          this.highlightId.set(next.id);
          document.getElementById('step-' + next.id)?.scrollIntoView({ block: 'nearest' });
          setTimeout(() => this.highlightId.set(null), 2600);
        } else {
          this.stepInput()?.nativeElement.focus();
        }
      },
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
