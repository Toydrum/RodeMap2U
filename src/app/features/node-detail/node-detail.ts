import { Component, ElementRef, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { inputValue } from '../../shared/ui/dom';
import { Router } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { NodesRepo } from '../../core/repos/nodes.repo';
import { TreesRepo } from '../../core/repos/trees.repo';
import { SessionsRepo } from '../../core/repos/sessions.repo';
import { HarvestsRepo } from '../../core/repos/harvests.repo';
import { ESTIMATE_CHOICES, EstimateMin, Harvest, NodePriority, NodeStatus, Tree, TreeNode } from '../../core/db/schema';
import { dayOf, isPast, today } from '../../core/time';
import { Cadence, cadenceOf } from '../../core/cadence';
import { ritualKind } from '../../core/harvest';
import { CadencePicker } from './cadence-picker';
import { SpiralGlyph } from '../forest/spiral';
import { ToastService, UNDO_MS } from '../../shared/ui/toast.service';
import { BloomBurstService } from '../../shared/ui/bloom-burst';
import { HarvestSkyService } from '../../shared/ui/harvest-sky';
import { flowerFor, fruitFor } from '../forest/flora';
import { BranchFlow } from './branch-flow';
import { SheetDirective } from '../../shared/ui/sheet.directive';
import { ConfirmSheet } from '../../shared/ui/confirm-sheet';
import { VisitSession } from '../../core/visit/visit-session';
import { PromiseService } from '../cosecha/promise.service';

// Life-cycle order, rest LAST (owner 2026-07-11): seed → growing → bloomed
// reads as the branch's natural arc; resting is the aside, not a stage.
const SELECTABLE_STATUSES: NodeStatus[] = ['seed', 'growing', 'achieved', 'resting'];

/** UI positions of the «luz» picker — 'steady' is the unstored default. */
export type LightChoice = 'sunlit' | 'steady' | 'shade';
const LIGHTS: LightChoice[] = ['sunlit', 'steady', 'shade'];
// ⛱️ matches the canvas parasol; 🌳 was colliding with «ver mi bosque».
const LIGHT_ICONS: Record<LightChoice, string> = { sunlit: '☀️', steady: '🌿', shade: '⛱️' };

@Component({
  selector: 'app-node-detail',
  imports: [BranchFlow, CadencePicker, SpiralGlyph, SheetDirective, ConfirmSheet],
  templateUrl: './node-detail.html',
  styleUrl: './node-detail.scss',
})
export class NodeDetail {
  protected readonly inputValue = inputValue;
  readonly node = input.required<TreeNode>();
  readonly tree = input.required<Tree>();
  readonly closed = output<void>();

  protected readonly i18n = inject(I18nService);
  protected readonly nodes = inject(NodesRepo);
  protected readonly trees = inject(TreesRepo);
  protected readonly sessions = inject(SessionsRepo);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly harvests = inject(HarvestsRepo);
  private readonly burst = inject(BloomBurstService);
  private readonly sky = inject(HarvestSkyService);
  private readonly promise = inject(PromiseService);

  protected readonly statuses = SELECTABLE_STATUSES;
  protected readonly lights = LIGHTS;
  protected readonly lightIcons = LIGHT_ICONS;
  /** «Brújula del tiempo» choices — null is «ni idea», a dignified answer. */
  protected readonly estimates = ESTIMATE_CHOICES;

  protected async setEstimate(minutes: EstimateMin | null): Promise<void> {
    // Re-tapping the selected chip clears back to «ni idea».
    const next = (this.node().estimateMin ?? null) === minutes ? null : minutes;
    await this.nodes.update(this.node(), { estimateMin: next });
  }

  protected estimateLabel(minutes: EstimateMin): string {
    const sizes = this.i18n.t().node.estimateSizes;
    switch (minutes) {
      case 60:
        return sizes.hour1;
      case 1440:
        return sizes.day1;
      case 10080:
        return sizes.week1;
      default:
        return minutes + ' ' + sizes.min;
    }
  }
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
  /** «Más detalles» fold — estimate + trigger live behind it. */
  protected readonly moreOpen = signal(false);

  /** The estimate editor only lives on live branches — the collapsed 🕐
   *  mark must promise exactly what expanding reveals (a stale estimate on
   *  an achieved/resting branch persists silently, but never advertises). */
  protected readonly estimateEditable = computed(() => {
    const status = this.node().status;
    return status === 'seed' || status === 'growing';
  });

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

  /** The picker celebrates a bloom exactly like bloomStep does (0.0.88 —
   *  it used to be SILENT: the same act celebrated or not depending on
   *  which control was tapped, a predictability wound). The picker itself
   *  is the undo affordance, so the toast carries no action; reopening
   *  stays quiet. */
  protected async setStatus(status: NodeStatus, ev?: Event): Promise<void> {
    // Capture the anchor BEFORE any await — the DOM nulls currentTarget the
    // moment the synchronous dispatch ends (the burst anchored to nothing
    // for a day).
    const anchor = (ev?.currentTarget as Element) ?? null;
    if (status === this.node().status) return;
    await this.nodes.setStatus(this.node(), status);
    if (status === 'achieved') {
      this.celebrateBloom(this.node(), anchor);
      this.toast.show({
        message: this.i18n.fill(this.i18n.t().ahora.bloomToast, { title: this.node().title }),
      });
    }
  }

  /** Two celebration layers, one voice each (0.0.89): the ACT layer — the
   *  small petal burst at the tap point, every bloom, everywhere — and the
   *  HARVEST layer — the full-screen petal fall + the earned-fruit card,
   *  ONLY when a fruit actually mints (sendero pasitos return null; visits
   *  never mint — the sky never lies). The canvas fruit drop plays behind
   *  on its own status diff. */
  private celebrateBloom(node: TreeNode, anchor: Element | null): void {
    const species = flowerFor(this.tree().accent, this.tree().id);
    this.burst.burstAt(anchor, species);
    if (!this.visiting) {
      void this.harvests.recordBloom(node, this.tree(), this.nodes.byId()).then((minted) => {
        if (minted) {
          this.sky.celebrate(species, fruitFor(minted.accent, minted.treeId), minted.title);
          this.offerToStore(minted);
        }
      });
    }
  }

  /** «La promesa» (0.0.93): right after a fruit mints, offer to store it in a
   *  goal jar (one tap for a single pending jar; the cross-page picker when
   *  more than one). Never during a visit — but recordBloom already gates that,
   *  so this only ever runs on the owner's own bloom. */
  private offerToStore(fruit: Harvest): void {
    if (this.visiting) return;
    const jars = this.promise.pending();
    if (!jars.length) return;
    if (jars.length === 1) {
      const jar = jars[0];
      this.toast.show(
        {
          message: this.i18n.fill(this.i18n.t().cosecha.promise.storeAsk, { name: jar.name }),
          actionLabel: this.i18n.t().cosecha.promise.storeAction,
          action: () => void this.promise.placeAndCelebrate(fruit.id, jar.id),
        },
        UNDO_MS,
      );
    } else {
      this.toast.show(
        {
          message: this.i18n.t().cosecha.promise.storeChoose,
          actionLabel: this.i18n.t().cosecha.promise.storeChooseAction,
          action: () => this.promise.requestPlacement(fruit),
        },
        UNDO_MS,
      );
    }
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

  /* --------------------------- «desmenuzar» — the task-paralysis wizard */

  /** Three compass questions, one at a time; each non-empty answer becomes
   *  a pasito IN THE USER'S OWN WORDS (the cuando-entonces philosophy — no
   *  AI, no templates). Every question is skippable; skipping all three
   *  plants nothing and closes without a word. */
  protected readonly crumbleStep = signal<number | null>(null);
  protected readonly crumbleAnswer = signal('');
  private crumbleAnswers: string[] = [];

  /** Offered while the branch is live and still standing bare (≤1 pasito). */
  protected readonly canCrumble = computed(() => {
    const status = this.node().status;
    return (status === 'seed' || status === 'growing') && this.children().length <= 1;
  });

  protected startCrumble(): void {
    this.crumbleAnswers = [];
    this.crumbleAnswer.set('');
    this.crumbleStep.set(0);
  }

  protected async crumbleNext(skip: boolean): Promise<void> {
    const answer = skip ? '' : this.crumbleAnswer().trim();
    if (answer) this.crumbleAnswers.push(answer);
    this.crumbleAnswer.set('');
    const step = this.crumbleStep() ?? 0;
    if (step < 2) {
      this.crumbleStep.set(step + 1);
      return;
    }
    this.crumbleStep.set(null);
    for (const title of this.crumbleAnswers) {
      await this.nodes.plant(this.node().treeId, this.node().id, { title });
    }
    if (this.crumbleAnswers.length) {
      this.toast.show({
        message: this.i18n.plural(this.crumbleAnswers.length, this.i18n.t().crumble.planted),
      });
    }
    this.crumbleAnswers = [];
  }

  protected closeCrumble(): void {
    this.crumbleStep.set(null);
    this.crumbleAnswer.set('');
    this.crumbleAnswers = [];
  }

  /** The pasitos become (or stop being) an ordered path. Never forced. */
  protected async toggleFlow(): Promise<void> {
    await this.nodes.update(this.node(), { flow: this.flowSteps() ? 'free' : 'steps' });
  }

  /** «El ritmo» (0.0.103): the branch's cadence, read ONLY via cadenceOf. */
  protected readonly cadence = computed(() => cadenceOf(this.node()));

  /** «Un ritual no se desmenuza» (0.0.104, owner rule): a ritual LEAF is a
   *  small act that repeats — the Pasitos section and Desmenuzar hide. */
  protected readonly isRitualLeaf = computed(() => ritualKind(this.node()) === 'leaf');

  /** The rhythm in words for the header chip — «Cada día», «L J», «Cada semana». */
  protected cadenceWords(): string {
    const c = this.cadence();
    if (!c) return '';
    const dict = this.i18n.t().cadence;
    if (c === 'daily') return dict.daily;
    if (c === 'weekly') return dict.weekly;
    return c.map((d) => dict.weekdayLetters[d]).join(' ');
  }

  /** Toggle on = daily by default; toggle off = clearing the rhythm (a
   *  ritual leaf RETIRES this way — its standing bloom then mints). Every
   *  cadence write mirrors the repeatsDaily compat shadow. */
  protected async toggleRepeats(): Promise<void> {
    await this.setCadence(this.cadence() ? null : 'daily');
  }

  /** «La historia se queda» (0.0.106): giving a rhythm to a leaf that
   *  bloomed on an EARLIER day would leave a flower reading «done today»
   *  forever — waking it (re-seed, fruit kept) is part of the choice, so
   *  the door asks first. Same-day blooms are the ritual's first period. */
  protected readonly confirmingWake = signal<Cadence | null>(null);

  protected async setCadence(c: Cadence | null): Promise<void> {
    const n = this.node();
    const needsWake =
      c != null &&
      !cadenceOf(n) &&
      n.flow !== 'steps' &&
      n.status === 'achieved' &&
      n.achievedAt != null &&
      dayOf(n.achievedAt) < today();
    if (needsWake) {
      this.confirmingWake.set(c);
      return;
    }
    await this.nodes.setCadence(n, c);
  }

  protected async confirmWake(): Promise<void> {
    const c = this.confirmingWake();
    this.confirmingWake.set(null);
    if (c) await this.nodes.setCadence(this.node(), c, true);
  }

  protected async moveStep(child: TreeNode, dir: -1 | 1): Promise<void> {
    await this.nodes.moveStep(child, dir);
  }

  /** Blooming a pasito is an unambiguous "done!" — celebrate it and offer
   *  the next move right at the dopamine peak: on an ordered path that is
   *  the NEXT step; otherwise, planting another tiny one. */
  protected async bloomStep(child: TreeNode, ev?: Event): Promise<void> {
    const anchor = (ev?.currentTarget as Element) ?? null;
    await this.nodes.setStatus(child, 'achieved');
    this.celebrateBloom(child, anchor);
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

  /** Body for the archive confirm — the subtree count folds into the text. */
  protected archiveBodyText(): string {
    const base = this.i18n.t().node.archiveNodeBody;
    return this.descendantCount() > 0
      ? base + ' ' + this.i18n.plural(this.descendantCount(), this.i18n.t().node.archiveNodeChildren)
      : base;
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
