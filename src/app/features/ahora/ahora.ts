import { Component, computed, inject, signal } from '@angular/core';
import { inputValue } from '../../shared/ui/dom';
import { HintChip } from '../../shared/ui/hint-chip';
import { Router, RouterLink } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { TreesRepo } from '../../core/repos/trees.repo';
import { NodesRepo } from '../../core/repos/nodes.repo';
import { SessionsRepo } from '../../core/repos/sessions.repo';
import { CheckinsRepo } from '../../core/repos/checkins.repo';
import { SettingsService } from '../../core/repos/settings.service';
import { FocusSessionService } from '../../core/focus-session.service';
import { ToastService } from '../../shared/ui/toast.service';
import { TreeNode } from '../../core/db/schema';
import { dayOf, daysFromToday, today } from '../../core/time';
import { MiniTree } from '../forest/mini-tree';
import { DateReview } from '../check-in/date-review';
import { SheetDirective } from '../../shared/ui/sheet.directive';
import { CompanionBird } from '../timer/companion-bird';
import { Suggestion, ThreadContext, pickAt, resolveThread, suggestionPool } from './suggest';

/**
 * Home. The companion surface: it remembers where you were headed (the
 * thread), offers exactly ONE next little step with its reason, and holds
 * the running session so nothing is ever lost by wandering. The forest
 * stays one tap away as the contemplative space.
 */
@Component({
  selector: 'app-ahora',
  imports: [RouterLink, MiniTree, DateReview, CompanionBird, SheetDirective, HintChip],
  templateUrl: './ahora.html',
  styleUrl: './ahora.scss',
})
export class AhoraPage {
  protected readonly inputValue = inputValue;
  protected readonly i18n = inject(I18nService);
  protected readonly focus = inject(FocusSessionService);
  protected readonly trees = inject(TreesRepo);
  protected readonly nodes = inject(NodesRepo);
  private readonly sessions = inject(SessionsRepo);
  private readonly checkins = inject(CheckinsRepo);
  private readonly settings = inject(SettingsService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly reviewing = signal(false);
  /** "Otra idea" taps; wraps at pool length so the cycle returns home. */
  private readonly ideaOffset = signal(0);

  /** Today-intentions picker sheet. */
  protected readonly pickingToday = signal(false);
  protected readonly pickedToday = signal<string[]>([]);

  /** Today's chosen branches — silently empty once the date moves on. */
  protected readonly todayNodes = computed<TreeNode[]>(() => {
    const intentions = this.settings.settings().todayIntentions;
    if (!intentions || intentions.date !== today()) return [];
    const activeIds = new Set(this.trees.active().map((t) => t.id));
    return intentions.nodeIds
      .map((id) => this.nodes.byId().get(id))
      .filter((n): n is TreeNode => !!n && !n.deletedAt && !n.archivedAt && activeIds.has(n.treeId));
  });

  protected readonly thread = computed(() =>
    resolveThread(this.trees.active(), this.nodes.byId(), this.sessions.all(), this.checkins.all()),
  );

  private readonly pool = computed(() =>
    suggestionPool(
      this.trees.active(),
      this.nodes.byTree(),
      (n) => this.nodes.childrenOf(n),
      this.sessions.all(),
      this.checkins.all(),
      this.nodes.byId(),
      this.todayNodes().map((n) => n.id),
      this.todayEnergy(),
    ),
  );

  /** Today's «regadera» token — only TODAY's check-in counts (energy is a
   *  moment, never a trend; yesterday's low says nothing about now). */
  private readonly todayEnergy = computed(() => {
    const latest = this.checkins.latest();
    if (!latest || !latest.energy) return null;
    return dayOf(latest.createdAt) === today()
      ? latest.energy
      : null;
  });

  protected readonly suggestion = computed(() => pickAt(this.pool(), this.ideaOffset(), today()));
  protected readonly canCycle = computed(() => this.pool().length > 1);

  protected readonly sessionNode = computed<TreeNode | null>(() => {
    const id = this.focus.active()?.nodeId;
    if (!id) return null;
    return (this.nodes.byId().get(id) as TreeNode | undefined) ?? null;
  });

  protected readonly birdState = this.focus.birdState;

  protected readonly pendingReviews = computed(() => {
    const activeIds = new Set(this.trees.active().map((t) => t.id));
    return this.nodes.needsDateReview().filter((n) => activeIds.has(n.treeId));
  });

  /** Ended minutes since local midnight — gratitude, never a quota. */
  protected readonly todayMinutes = computed(() => {
    const start = new Date().setHours(0, 0, 0, 0);
    return Math.round(
      this.sessions
        .all()
        .filter((s) => s.endedAt !== null && s.startedAt >= start)
        .reduce((sum, s) => sum + (s.endedAt! - s.startedAt), 0) / 60_000,
    );
  });

  protected otherIdea(): void {
    this.ideaOffset.update((n) => (n + 1) % Math.max(1, this.pool().length));
  }

  /** The smallest possible door: touch it for two little minutes, in place.
   *  A BARE top-level goal (no pasitos yet — the classic task-paralysis
   *  shape) gets one compass question first: «¿cuál sería el primer pasito
   *  de dos minutitos?» — the answer is planted and becomes the session's
   *  node. Skipping starts on the goal as always: a door, never a gate. */
  protected readonly firstPasitoAsk = signal(false);
  protected readonly firstPasitoText = signal('');

  protected async ramp2(): Promise<void> {
    const s = this.suggestion();
    if (!s) return;
    const bareGoal = s.node.parentId === null && this.nodes.childrenOf(s.node).length === 0;
    if (bareGoal) {
      this.firstPasitoAsk.set(true);
      return;
    }
    await this.focus.start(s.node.id, 2);
  }

  /** Backdrop/Escape = changed my mind: close, plant nothing, START nothing.
   *  Only the two explicit buttons commit («así nomás» skips the question but
   *  still chose to begin) — dismissing a door must never start a session. */
  protected firstPasitoCancel(): void {
    this.firstPasitoAsk.set(false);
    this.firstPasitoText.set('');
  }

  protected async firstPasitoGo(skip: boolean): Promise<void> {
    const s = this.suggestion();
    this.firstPasitoAsk.set(false);
    if (!s) return;
    const title = skip ? '' : this.firstPasitoText().trim();
    this.firstPasitoText.set('');
    if (!title) {
      await this.focus.start(s.node.id, 2);
      return;
    }
    const pasito = await this.nodes.plant(s.node.treeId, s.node.id, { title });
    await this.focus.start(pasito.id, 2);
  }

  protected goSession(): void {
    const s = this.suggestion();
    void this.router.navigate(['/timer'], s ? { queryParams: { node: s.node.id } } : {});
  }

  protected pauseResume(): void {
    if (this.focus.paused()) this.focus.resume();
    else this.focus.pause();
  }

  /** Plain toast on purpose — this page's body IS the momentum surface. */
  protected async finishSession(): Promise<void> {
    const minutes = await this.focus.finish();
    this.toast.show({
      message:
        minutes >= 2
          ? this.i18n.fill(this.i18n.t().timer.wellDone, { minutes })
          : this.i18n.t().timer.wellDoneShort,
    });
  }

  /** ONE secondary line under the suggestion — never a stack. The card is
   *  the doctrine's hero; four justification lines buried it. Priority:
   *  first-then (actionable) > shade aside (honesty) > estimate whisper. */
  protected secondaryLine(s: Suggestion): { kind: 'steps' | 'shade' | 'estimate'; text: string } | null {
    const ft = this.firstThen(s);
    if (ft) return { kind: 'steps', text: ft };
    const aside = this.shadeAside(s);
    if (aside) return { kind: 'shade', text: aside };
    if (s.node.estimateMin) {
      return { kind: 'estimate', text: '🕐 ' + this.estimateHintText(s.node.estimateMin) };
    }
    return null;
  }

  /** «~1 día, decías» — the size in words (minutes only under an hour). */
  protected estimateHintText(minutes: number): string {
    const t = this.i18n.t().ahora;
    const size =
      minutes === 60
        ? t.estimateSizes.hour
        : minutes === 1440
          ? t.estimateSizes.day
          : minutes === 10080
            ? t.estimateSizes.week
            : this.i18n.fill(t.estimateSizes.minutes, { n: String(minutes) });
    return this.i18n.fill(t.estimateHint, { size });
  }

  protected reasonText(s: Suggestion): string {
    const t = this.i18n.t().ahora;
    // A bajita day speaks first — the honest reason IS the small door.
    if (s.lowEnergy) return t.reasonLowEnergy;
    switch (s.kind) {
      case 'today':
        return t.reasonToday;
      case 'trigger':
        return this.i18n.fill(t.reasonTrigger, { trigger: s.node.trigger ?? '' });
      case 'sunlit':
        return t.reasonSunlit;
      case 'step-of-current':
        return this.i18n.fill(t.reasonStepOfCurrent, { title: s.parent?.title ?? '' });
      case 'step-in-order':
        return this.i18n.fill(t.reasonStepInOrder, { title: s.parent?.title ?? '' });
      case 'current':
        return t.reasonCurrent;
      case 'recent':
        return t.reasonRecent;
      case 'fresh-growing':
        return this.i18n.fill(t.reasonFreshGrowing, { tree: s.tree.name });
      case 'fresh-seed':
        return this.i18n.fill(t.reasonFreshSeed, { tree: s.tree.name });
    }
  }

  /** A shaded branch may still surface AMBIENTLY (deep "Otra idea" cycle,
   *  tiny forest) — one quiet aside prevents "why suggest what I shaded",
   *  judging nothing. Deliberate paths (today/twig/thread/steps) stay clean:
   *  you went there on purpose. */
  protected shadeAside(s: Suggestion): string | null {
    const ambient = s.kind === 'recent' || s.kind === 'fresh-growing' || s.kind === 'fresh-seed';
    return ambient && s.node.priority === 'shade' ? this.i18n.t().ahora.shadeAside : null;
  }

  /** First→then in tree language: on an ordered path, say what follows —
   *  the step after this one, or the branch blooming when it's the last. */
  protected firstThen(s: Suggestion): string | null {
    if (s.kind !== 'step-in-order' || !s.parent) return null;
    const t = this.i18n.t().ahora;
    const after = this.nodes
      .childrenOf(s.parent)
      .find((c) => c.order > s.node.order && (c.status === 'seed' || c.status === 'growing'));
    return this.i18n.fill(t.firstThen, {
      step: s.node.title,
      then: after ? after.title : t.thenBloom,
    });
  }

  /* ------------------------------------------- today's little branches */

  protected openTodayPicker(): void {
    this.pickedToday.set(this.todayNodes().map((n) => n.id));
    this.pickingToday.set(true);
  }

  protected toggleToday(id: string): void {
    this.pickedToday.update((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : ids.length < 3 ? [...ids, id] : ids,
    );
  }

  protected async saveToday(): Promise<void> {
    const ids = this.pickedToday();
    await this.settings.patch({
      todayIntentions: ids.length ? { date: today(), nodeIds: ids } : null,
    });
    this.pickingToday.set(false);
    this.ideaOffset.set(0);
  }

  /** Candidates for the picker: the pool's nodes, deduped, in rank order. */
  protected readonly todayChoices = computed(() => {
    const chosen = new Set(this.pickedToday());
    return this.pool().map((s) => ({ s, chosen: chosen.has(s.node.id) }));
  });

  protected threadLine(t: ThreadContext): string {
    const dict = this.i18n.t().ahora;
    const at = new Date(t.at);
    const dateKey = dayOf(t.at);
    const days = daysFromToday(dateKey);
    const locale = this.i18n.lang() === 'en' ? 'en' : 'es';
    const date = at.toLocaleDateString(locale, { day: 'numeric', month: 'long' });
    if (t.source === 'session') {
      const minutes = String(t.minutes ?? 1);
      if (days === 0) return this.i18n.fill(dict.threadSessionToday, { minutes });
      if (days === -1) return this.i18n.fill(dict.threadSessionYesterday, { minutes });
      return this.i18n.fill(dict.threadSessionPast, { minutes, date });
    }
    if (t.source === 'checkin') {
      if (days === 0) return dict.threadCheckinToday;
      if (days === -1) return dict.threadCheckinYesterday;
      return this.i18n.fill(dict.threadCheckinPast, { date });
    }
    return dict.threadPointer;
  }
}
