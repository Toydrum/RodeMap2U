import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { inputValue } from '../../shared/ui/dom';
import { HintChip } from '../../shared/ui/hint-chip';
import { Router } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { FocusSessionService } from '../../core/focus-session.service';
import { NodesRepo } from '../../core/repos/nodes.repo';
import { TreesRepo } from '../../core/repos/trees.repo';
import { SessionsRepo } from '../../core/repos/sessions.repo';
import { CheckinsRepo } from '../../core/repos/checkins.repo';
import { SettingsService } from '../../core/repos/settings.service';
import { ToastService } from '../../shared/ui/toast.service';
import { AccentToken, TreeNode, lightRank } from '../../core/db/schema';
import { CompanionBird } from './companion-bird';
import { suggestNext } from '../ahora/suggest';

const PRESETS = [10, 25, 45];

interface NodeChoice {
  node: TreeNode;
  accent: AccentToken;
  treeName: string;
  isCurrent: boolean;
}

/**
 * A gentle focus timer — now a thin view over FocusSessionService, so the
 * session survives navigating away and even a reload. Ending is celebrated
 * no matter how long you stayed.
 */
@Component({
  selector: 'app-timer',
  imports: [CompanionBird, HintChip],
  templateUrl: './timer.html',
  styleUrl: './timer.scss',
})
export class TimerPage {
  protected readonly inputValue = inputValue;
  /** Optional ?node= query param (withComponentInputBinding). */
  readonly node = input<string | undefined>();

  protected readonly i18n = inject(I18nService);
  protected readonly focus = inject(FocusSessionService);
  protected readonly nodes = inject(NodesRepo);
  protected readonly trees = inject(TreesRepo);
  private readonly sessions = inject(SessionsRepo);
  private readonly checkins = inject(CheckinsRepo);
  private readonly settings = inject(SettingsService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly presets = PRESETS;
  protected readonly minutes = signal(this.settings.settings().timerDefaultMinutes);

  /** `?node=` seeds the picker; the chips can override it. */
  protected readonly pickedNodeId = linkedSignal<string | null>(() => this.node() ?? null);

  /** Same spirit as the check-in candidates: living branches, current first,
   *  then by light — a sunlit branch never gets cut by four fresher ones. */
  protected readonly nodeChoices = computed<NodeChoice[]>(() => {
    const currentIds = new Set(
      this.trees.active().map((t) => t.currentNodeId).filter(Boolean),
    );
    const out: NodeChoice[] = [];
    for (const tree of this.trees.active()) {
      // «El corazón del árbol» (0.0.112): the heart with ramitas is the
      // goal's center, not a focusable task — its ramitas are. A bare
      // heart stays pickable (a one-tree forest must not empty the picker).
      const heart = this.nodes.heartOf(tree.id);
      const picks = (this.nodes.byTree().get(tree.id) ?? [])
        .filter((n) => n.status === 'growing' || n.status === 'seed')
        .filter((n) => !(heart && n.id === heart.id && this.nodes.childrenOf(n).length > 0))
        .sort((a, b) => lightRank(a) - lightRank(b) || b.updatedAt - a.updatedAt)
        .slice(0, 4);
      for (const node of picks) {
        out.push({ node, accent: tree.accent, treeName: tree.name, isCurrent: currentIds.has(node.id) });
      }
    }
    return out
      .sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent) || lightRank(a.node) - lightRank(b.node))
      .slice(0, 8);
  });

  protected readonly linkedNode = computed<TreeNode | null>(() => {
    const id = this.focus.active()?.nodeId ?? this.pickedNodeId();
    return id ? ((this.nodes.byId().get(id) as TreeNode | undefined) ?? null) : null;
  });

  protected readonly birdState = this.focus.birdState;

  protected start(): Promise<void> {
    return this.focus.start(this.pickedNodeId(), this.minutes());
  }

  protected pauseResume(): void {
    if (this.focus.paused()) {
      this.focus.resume();
    } else {
      this.focus.pause();
    }
  }

  protected async finish(): Promise<void> {
    const minutes = await this.focus.finish();
    // Momentum at the dopamine moment: offer ONE more little step, on Ahora.
    const next = suggestNext(
      this.trees.active(),
      this.nodes.byTree(),
      (n) => this.nodes.childrenOf(n),
      this.sessions.all(),
      this.checkins.all(),
      this.nodes.byId(),
    );
    this.toast.show({
      message:
        minutes >= 2
          ? this.i18n.fill(this.i18n.t().timer.wellDone, { minutes })
          : this.i18n.t().timer.wellDoneShort,
      ...(next
        ? {
            actionLabel: this.i18n.t().ahora.momentumAction,
            action: () => void this.router.navigate(['/ahora']),
          }
        : {}),
    });
  }

  protected setPreset(minutes: number): void {
    this.minutes.set(minutes);
    void this.settings.patch({ timerDefaultMinutes: minutes });
  }

  /** Custom input: keep the previous value when the field is emptied. */
  protected setCustom(raw: string): void {
    const value = Math.min(180, Math.max(1, Math.round(+raw)));
    if (Number.isFinite(value) && value > 0) this.setPreset(value);
  }
}
