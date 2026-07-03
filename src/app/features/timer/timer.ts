import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { FocusSessionService } from '../../core/focus-session.service';
import { NodesRepo } from '../../core/repos/nodes.repo';
import { TreesRepo } from '../../core/repos/trees.repo';
import { SettingsService } from '../../core/repos/settings.service';
import { ToastService } from '../../shared/ui/toast.service';
import { AccentToken, TreeNode } from '../../core/db/schema';

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
  templateUrl: './timer.html',
  styleUrl: './timer.scss',
})
export class TimerPage {
  /** Optional ?node= query param (withComponentInputBinding). */
  readonly node = input<string | undefined>();

  protected readonly i18n = inject(I18nService);
  protected readonly focus = inject(FocusSessionService);
  protected readonly nodes = inject(NodesRepo);
  protected readonly trees = inject(TreesRepo);
  private readonly settings = inject(SettingsService);
  private readonly toast = inject(ToastService);

  protected readonly presets = PRESETS;
  protected readonly minutes = signal(this.settings.settings().timerDefaultMinutes);

  /** `?node=` seeds the picker; the chips can override it. */
  protected readonly pickedNodeId = linkedSignal<string | null>(() => this.node() ?? null);

  /** Same spirit as the check-in candidates: living branches, current first. */
  protected readonly nodeChoices = computed<NodeChoice[]>(() => {
    const currentIds = new Set(
      this.trees.active().map((t) => t.currentNodeId).filter(Boolean),
    );
    const out: NodeChoice[] = [];
    for (const tree of this.trees.active()) {
      const picks = (this.nodes.byTree().get(tree.id) ?? [])
        .filter((n) => n.status === 'growing' || n.status === 'seed')
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 4);
      for (const node of picks) {
        out.push({ node, accent: tree.accent, treeName: tree.name, isCurrent: currentIds.has(node.id) });
      }
    }
    return out.sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent)).slice(0, 8);
  });

  protected readonly linkedNode = computed<TreeNode | null>(() => {
    const id = this.focus.active()?.nodeId ?? this.pickedNodeId();
    return id ? ((this.nodes.byId().get(id) as TreeNode | undefined) ?? null) : null;
  });

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
    this.toast.show({
      message:
        minutes >= 2
          ? this.i18n.fill(this.i18n.t().timer.wellDone, { minutes })
          : this.i18n.t().timer.wellDoneShort,
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
