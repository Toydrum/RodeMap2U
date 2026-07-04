import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { TreesRepo } from '../../core/repos/trees.repo';
import { NodesRepo } from '../../core/repos/nodes.repo';
import { SessionsRepo } from '../../core/repos/sessions.repo';
import { CheckinsRepo } from '../../core/repos/checkins.repo';
import { FocusSessionService } from '../../core/focus-session.service';
import { ToastService } from '../../shared/ui/toast.service';
import { TreeNode } from '../../core/db/schema';
import { daysFromToday, today } from '../../core/time';
import { MiniTree } from '../forest/mini-tree';
import { DateReview } from '../check-in/date-review';
import { BirdState, CompanionBird, birdStateFrom } from '../timer/companion-bird';
import { Suggestion, ThreadContext, pickAt, resolveThread, suggestionPool } from './suggest';

/**
 * Home. The companion surface: it remembers where you were headed (the
 * thread), offers exactly ONE next little step with its reason, and holds
 * the running session so nothing is ever lost by wandering. The forest
 * stays one tap away as the contemplative space.
 */
@Component({
  selector: 'app-ahora',
  imports: [RouterLink, MiniTree, DateReview, CompanionBird],
  templateUrl: './ahora.html',
  styleUrl: './ahora.scss',
})
export class AhoraPage {
  protected readonly i18n = inject(I18nService);
  protected readonly focus = inject(FocusSessionService);
  protected readonly trees = inject(TreesRepo);
  protected readonly nodes = inject(NodesRepo);
  private readonly sessions = inject(SessionsRepo);
  private readonly checkins = inject(CheckinsRepo);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly reviewing = signal(false);
  /** "Otra idea" taps; wraps at pool length so the cycle returns home. */
  private readonly ideaOffset = signal(0);

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
    ),
  );

  protected readonly suggestion = computed(() => pickAt(this.pool(), this.ideaOffset(), today()));
  protected readonly canCycle = computed(() => this.pool().length > 1);

  protected readonly sessionNode = computed<TreeNode | null>(() => {
    const id = this.focus.active()?.nodeId;
    if (!id) return null;
    return (this.nodes.byId().get(id) as TreeNode | undefined) ?? null;
  });

  protected readonly birdState = computed<BirdState>(() =>
    birdStateFrom(this.focus.paused(), this.focus.overtime(), this.focus.plannedMs() - this.focus.elapsedMs()),
  );

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

  /** The smallest possible door: touch it for two little minutes, in place. */
  protected async ramp2(): Promise<void> {
    const s = this.suggestion();
    if (s) await this.focus.start(s.node.id, 2);
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

  protected reasonText(s: Suggestion): string {
    const t = this.i18n.t().ahora;
    switch (s.kind) {
      case 'step-of-current':
        return this.i18n.fill(t.reasonStepOfCurrent, { title: s.parent?.title ?? '' });
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

  protected threadLine(t: ThreadContext): string {
    const dict = this.i18n.t().ahora;
    const at = new Date(t.at);
    const dateKey = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
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
