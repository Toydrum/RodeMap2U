import { Component, OnDestroy, computed, inject, input, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { SessionsRepo } from '../../core/repos/sessions.repo';
import { NodesRepo } from '../../core/repos/nodes.repo';
import { SettingsService } from '../../core/repos/settings.service';
import { ToastService } from '../../shared/ui/toast.service';
import { TimerSession, TreeNode } from '../../core/db/schema';

const PRESETS = [10, 25, 45];

/**
 * A gentle focus timer. Elapsed time is ALWAYS computed from timestamps —
 * the interval only refreshes the display. Ending is celebrated no matter
 * how long you stayed.
 */
@Component({
  selector: 'app-timer',
  templateUrl: './timer.html',
  styleUrl: './timer.scss',
})
export class TimerPage implements OnDestroy {
  /** Optional ?node= query param (withComponentInputBinding). */
  readonly node = input<string | undefined>();

  protected readonly i18n = inject(I18nService);
  protected readonly sessions = inject(SessionsRepo);
  protected readonly nodes = inject(NodesRepo);
  private readonly settings = inject(SettingsService);
  private readonly toast = inject(ToastService);

  protected readonly presets = PRESETS;
  protected readonly minutes = signal(this.settings.settings().timerDefaultMinutes);
  protected readonly session = signal<TimerSession | null>(null);
  protected readonly paused = signal(false);

  /** Timestamp bookkeeping: elapsed = pausedAccum + (now - runningSince). */
  private pausedAccum = 0;
  private runningSince = 0;
  private readonly nowTick = signal(Date.now());
  private readonly interval = setInterval(() => this.nowTick.set(Date.now()), 500);

  protected readonly linkedNode = computed<TreeNode | null>(() => {
    const id = this.node();
    return id ? ((this.nodes.byId().get(id) as TreeNode | undefined) ?? null) : null;
  });

  protected readonly elapsedMs = computed(() => {
    if (!this.session()) return 0;
    const running = this.paused() ? 0 : this.nowTick() - this.runningSince;
    return this.pausedAccum + Math.max(0, running);
  });

  protected readonly plannedMs = computed(() => (this.session()?.plannedMinutes ?? this.minutes()) * 60_000);

  /** 0–1 for the breathing ring; gently caps at 1, never alarms past it. */
  protected readonly progress = computed(() => Math.min(1, this.elapsedMs() / this.plannedMs()));

  protected readonly display = computed(() => {
    const total = Math.floor(this.elapsedMs() / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  });

  constructor() {
    // A session left open from a previous visit gets closed with care.
    const orphan = this.sessions.running();
    if (orphan) {
      void this.sessions.end(orphan);
      this.toast.show({ message: this.i18n.t().timer.stillRunning });
    }
  }

  protected async start(): Promise<void> {
    const session = await this.sessions.start(this.linkedNode()?.id ?? null, this.minutes());
    this.pausedAccum = 0;
    this.runningSince = Date.now();
    this.paused.set(false);
    this.session.set(session);
  }

  protected pauseResume(): void {
    if (this.paused()) {
      this.runningSince = Date.now();
      this.paused.set(false);
    } else {
      this.pausedAccum += Date.now() - this.runningSince;
      this.paused.set(true);
    }
  }

  protected async finish(): Promise<void> {
    const session = this.session();
    if (!session) return;
    await this.sessions.end(session);
    const minutes = Math.max(1, Math.round(this.elapsedMs() / 60_000));
    this.toast.show({
      message:
        minutes >= 2
          ? this.i18n.fill(this.i18n.t().timer.wellDone, { minutes })
          : this.i18n.t().timer.wellDoneShort,
    });
    this.session.set(null);
    this.paused.set(false);
    this.pausedAccum = 0;
  }

  protected setPreset(minutes: number): void {
    this.minutes.set(minutes);
    void this.settings.patch({ timerDefaultMinutes: minutes });
  }

  ngOnDestroy(): void {
    clearInterval(this.interval);
  }
}
