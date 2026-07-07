import { Component, ElementRef, computed, effect, inject, input, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { TreesRepo } from '../../core/repos/trees.repo';
import { NodesRepo } from '../../core/repos/nodes.repo';
import { ToastService, UNDO_MS } from '../../shared/ui/toast.service';
import { FocusSessionService } from '../../core/focus-session.service';
import { CheckinsRepo } from '../../core/repos/checkins.repo';
import { Feeling, TreeNode } from '../../core/db/schema';
import { TreeCanvas } from './tree-canvas';
import { TreeOutline } from './tree-outline';
import { SceneBackdrop } from './scene-backdrop';
import { WeatherFront } from './weather-front';
import { SheetDirective } from '../../shared/ui/sheet.directive';
import { NodeDetail } from '../node-detail/node-detail';
import { DateReview } from '../check-in/date-review';
import { VisitSession } from '../../core/visit/visit-session';

@Component({
  selector: 'app-tree-view',
  imports: [RouterLink, TreeCanvas, TreeOutline, SceneBackdrop, WeatherFront, NodeDetail, DateReview, SheetDirective],
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

  /** Present only under /visit/:userId — the page then works on SOMEONE
   *  ELSE'S forest (route-scoped repos): session/archive affordances hide,
   *  the sky stays neutral (their feelings are private), back goes home. */
  protected readonly visit = inject(VisitSession, { optional: true });

  protected readonly tree = computed(() => this.trees.byId().get(this.id()) ?? null);

  protected readonly backLink = computed(() =>
    this.visit ? ['/visit', this.visit.userId()] : ['/forest'],
  );

  /** Friend visits are look-only: taps locate, nothing plants, no sheets.
   *  Guardians (editable visits) and the owner keep the whole toolkit. */
  protected readonly canEdit = computed(() => !this.visit || this.visit.editable());

  private readonly checkins = inject(CheckinsRepo);
  private readonly moodOverride = new URLSearchParams(location.search).get('mood') as Feeling | null;
  protected readonly mood = computed<Feeling | null>(() =>
    this.visit ? null : (this.moodOverride ?? this.checkins.latest()?.feeling ?? null),
  );

  protected readonly openNode = signal<TreeNode | null>(null);

  private readonly route = inject(ActivatedRoute);
  /** `?node=` deep link (e.g. from "Tus huellas"): open that branch's sheet on arrival. */
  private pendingOpenId = this.route.snapshot.queryParamMap.get('node');

  constructor() {
    effect(() => {
      if (!this.pendingOpenId || !this.canEdit()) return;
      const node = this.nodes.byId().get(this.pendingOpenId) as TreeNode | undefined;
      if (!node || node.treeId !== this.id()) return;
      this.pendingOpenId = null;
      this.openNode.set(node);
      const params = { ...this.route.snapshot.queryParams, node: null };
      void this.router.navigate([], { queryParams: params, replaceUrl: true });
    });
  }
  /** null = closed; { parent: null } = plant a root; { parent: node } = plant under it. */
  protected readonly planting = signal<{ parent: TreeNode | null } | null>(null);
  protected readonly reviewing = signal(false);
  protected readonly archiving = signal(false);
  protected readonly newTitle = signal('');
  /** Little branches planted since this sheet opened — a celebration, not a counter. */
  protected readonly plantedCount = signal(0);
  /** "Varios a la vez": one line = one branch; indent = child of the line above. */
  protected readonly sowMode = signal(false);
  protected readonly sowText = signal('');
  private readonly plantInput = viewChild<ElementRef<HTMLInputElement>>('plantInput');
  private readonly toast = inject(ToastService);
  private readonly focus = inject(FocusSessionService);
  /** First branch planted this sheet session — the burst invitation's door. */
  private burstFirstId: string | null = null;
  private burstInvited = false;

  /** Dates on THIS tree wanting a word. */
  protected readonly pendingReviews = computed(() =>
    this.nodes.needsDateReview().filter((n) => n.treeId === this.id()),
  );

  protected readonly branchCount = computed(() => (this.nodes.byTree().get(this.id()) ?? []).length);
  protected readonly bloomCount = computed(
    () => (this.nodes.byTree().get(this.id()) ?? []).filter((n) => n.status === 'achieved').length,
  );

  protected onNodeOpened(node: TreeNode): void {
    if (!this.canEdit()) {
      this.canvas()?.focusNode(node.id); // look-only visit: locate, never open
      return;
    }
    this.openNode.set(node);
  }

  /* -------------------------------------------- the "tablita" outline */

  protected readonly outlineOpen = signal(false);
  private readonly canvas = viewChild(TreeCanvas);
  protected readonly outlineFocusId = computed(() => this.canvas()?.focusedId() ?? null);

  /** Outline tap: put the branch in view and speak its name — nothing opens. */
  protected locateNode(node: TreeNode): void {
    this.canvas()?.focusNode(node.id);
    if (window.innerWidth < 700) this.outlineOpen.set(false);
  }

  /** Second tap on the same row: open its sheet (locate-only on look-only visits). */
  protected outlineOpenNode(node: TreeNode): void {
    if (!this.canEdit()) {
      this.locateNode(node);
      return;
    }
    this.openNode.set(node);
    if (window.innerWidth < 980) this.outlineOpen.set(false);
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

  protected openPlanting(parent: TreeNode | null): void {
    if (!this.canEdit()) return; // canvas "+" bud on a look-only visit
    this.plantedCount.set(0);
    this.newTitle.set('');
    this.sowText.set('');
    this.burstFirstId = null;
    this.planting.set({ parent });
  }

  /** Closing the sheet after a real planting burst earns ONE gentle
   *  invitation to touch something — an offer, never a nag. */
  protected closePlanting(): void {
    const count = this.plantedCount();
    const firstId = this.burstFirstId;
    this.planting.set(null);
    // Never on a visit: a session would be the VISITOR'S, on a node that
    // lives in someone else's forest.
    if (count >= 6 && firstId && !this.burstInvited && !this.visit && !this.focus.active()) {
      this.burstInvited = true;
      this.toast.show({
        message: this.i18n.t().sow.burstInvite,
        actionLabel: this.i18n.t().whispers.tinyAction,
        action: () => void this.focus.start(firstId, 2),
      });
    }
  }

  /** The sheet stays open: name, Enter, name, Enter — the tree grows behind it. */
  protected async plant(): Promise<void> {
    const tree = this.tree();
    const target = this.planting();
    const title = this.newTitle().trim();
    if (!tree || !target || !title) return;
    const node = await this.nodes.plant(tree.id, target.parent?.id ?? null, { title });
    if (!tree.currentNodeId) await this.trees.setCurrentNode(tree, node.id);
    this.burstFirstId ??= node.id;
    this.newTitle.set('');
    this.plantedCount.update((c) => c + 1);
    this.plantInput()?.nativeElement.focus();
  }

  /** Brain-dump planting: every line sows a branch; leading tabs (or pairs
   *  of spaces) hang it from the nearest shallower line above. Paste-friendly. */
  protected async sow(): Promise<void> {
    const tree = this.tree();
    const target = this.planting();
    if (!tree || !target) return;
    const lines = this.sowText()
      .split('\n')
      .map((raw) => {
        const lead = raw.match(/^[\t ]*/)![0];
        const tabs = lead.split('\t').length - 1;
        const spacePairs = Math.floor(lead.replaceAll('\t', '').length / 2);
        return { depth: tabs + spacePairs, title: raw.trim() };
      })
      .filter((l) => l.title);
    if (!lines.length) return;

    const stack: { depth: number; node: TreeNode }[] = [];
    let count = 0;
    for (const line of lines) {
      while (stack.length && stack[stack.length - 1].depth >= line.depth) stack.pop();
      const parent = stack.length ? stack[stack.length - 1].node : (target.parent ?? null);
      const node = await this.nodes.plant(tree.id, parent?.id ?? null, { title: line.title });
      this.burstFirstId ??= node.id;
      stack.push({ depth: line.depth, node });
      count++;
    }
    const fresh = this.tree();
    if (fresh && !fresh.currentNodeId && this.burstFirstId) {
      const first = this.nodes.byId().get(this.burstFirstId) as TreeNode | undefined;
      if (first) await this.trees.setCurrentNode(fresh, first.id);
    }
    this.sowText.set('');
    this.plantedCount.update((c) => c + count);
  }

  /** Tab indents inside the sowing box instead of walking focus away. */
  protected insertTab(el: HTMLTextAreaElement): void {
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    el.value = el.value.slice(0, start) + '\t' + el.value.slice(end);
    el.selectionStart = el.selectionEnd = start + 1;
    this.sowText.set(el.value);
  }

  protected notFoundGoHome(): void {
    void this.router.navigate(this.backLink());
  }

  /** "Delete" the compass way: the tree rests in the archive, recoverable. */
  protected async archiveTree(): Promise<void> {
    const tree = this.tree();
    if (!tree) return;
    await this.trees.archive(tree);
    this.archiving.set(false);
    this.toast.show(
      {
        message: this.i18n.fill(this.i18n.t().tree.archivedToast, { name: tree.name }),
        actionLabel: this.i18n.t().common.undo,
        action: () => void this.trees.restore(tree),
      },
      UNDO_MS,
    );
    void this.router.navigate(['/forest']);
  }
}
