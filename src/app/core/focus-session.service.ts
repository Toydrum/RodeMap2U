import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { SessionsRepo } from './repos/sessions.repo';
import { SettingsService } from './repos/settings.service';
import { ToastService } from '../shared/ui/toast.service';
import { I18nService } from './i18n/i18n.service';
import { BirdState, birdStateFrom } from './bird-state';

export interface ActiveFocus {
  nodeId: string | null;
  plannedMinutes: number;
  /** Epoch ms — the single source of truth for elapsed time. */
  startedAt: number;
  /** Non-null while paused. */
  pausedAt: number | null;
  accumulatedPausedMs: number;
  /** The SessionsRepo row backing this session. */
  sessionId: string;
}

/** A session started before an app reload is adopted if it's this fresh. */
const ADOPT_WINDOW_MS = 8 * 60 * 60 * 1000;

/**
 * The focus session lives HERE, not in the timer page: navigating away no
 * longer abandons it, a reload adopts the open IndexedDB row, and reaching
 * the planted time gives ONE gentle cue (toast + 🌸 on the tab title) —
 * never an alarm, never an auto-end.
 */
@Injectable({ providedIn: 'root' })
export class FocusSessionService {
  private readonly sessions = inject(SessionsRepo);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);

  private readonly state = signal<ActiveFocus | null>(null);
  readonly active = this.state.asReadonly();
  readonly paused = computed(() => this.state()?.pausedAt != null);

  /** Display clock — written ONLY while running (not paused). */
  private readonly now = signal(Date.now());
  private ticker: ReturnType<typeof setInterval> | null = null;
  /** One-time completion-cue latch; pre-set when adopting an overtime orphan. */
  private celebrated = false;

  readonly plannedMs = computed(() => (this.state()?.plannedMinutes ?? 0) * 60_000);

  /** ALWAYS timestamp math — the tick only refreshes the display. */
  readonly elapsedMs = computed(() => {
    const active = this.state();
    if (!active) return 0;
    const end = active.pausedAt ?? this.now();
    return Math.max(0, end - active.startedAt - active.accumulatedPausedMs);
  });

  /** 0–1 for the breathing ring; gently caps at 1, never alarms past it. */
  readonly progress = computed(() =>
    this.state() ? Math.min(1, this.elapsedMs() / this.plannedMs()) : 0,
  );

  readonly overtime = computed(
    () => this.state() !== null && this.elapsedMs() >= this.plannedMs(),
  );

  /** The golden approach-bridge window — user-widenable (2 or 5 min):
   *  a hyperfocus exit-ramp / transition preparation. Visual only. */
  private readonly settings = inject(SettingsService);
  readonly bridgeMs = computed(() => (this.settings.settings().bridgeMinutes ?? 2) * 60_000);

  /** THE shared pose — every surface hosting the parakeet reads this one
   *  computed (timer ring, ahora card, corner + scene perches). */
  readonly birdState = computed<BirdState>(() =>
    birdStateFrom(
      this.paused(),
      this.overtime(),
      this.plannedMs() - this.elapsedMs(),
      this.bridgeMs(),
    ),
  );

  readonly display = computed(() => {
    const total = Math.floor(this.elapsedMs() / 1000);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  });

  constructor() {
    this.adoptOrphan();

    // The session is GLOBAL, not per-tab: the repo is cross-tab fresh via
    // BroadcastChannel, so mirror it — a session started in another tab
    // appears here (whispers then respect it, the timer page shows it, and
    // no second session can be started); one finished elsewhere clears here.
    effect(() => {
      const running = this.sessions.running();
      const mine = this.state();
      if (!mine && running && Date.now() - running.startedAt <= ADOPT_WINDOW_MS) {
        this.adoptRow(running);
      } else if (mine && (!running || running.id !== mine.sessionId)) {
        const row = this.sessions.byId().get(mine.sessionId);
        if (!row || row.endedAt !== null) {
          this.stopTicker();
          this.state.set(null);
        }
      }
    });

    // Completion cue: one gentle toast when the planted time blooms —
    // on whatever route you're on (the toast lives in the app shell).
    effect(() => {
      if (!this.overtime() || this.celebrated) return;
      this.celebrated = true;
      this.toast.show({ message: this.i18n.t().timer.plannedBloomed });
    });

    // '🌸' rides the tab title while overtime. The URL dependency re-applies
    // it after every navigation (TitleStrategy rewrites document.title).
    const router = inject(Router);
    const url = toSignal(router.events.pipe(map(() => router.url)), {
      initialValue: router.url,
    });
    effect(() => {
      url();
      const base = document.title.replace(/ 🌸$/u, '');
      document.title = this.overtime() ? `${base} 🌸` : base;
    });
  }

  async start(nodeId: string | null, minutes: number): Promise<void> {
    if (this.state()) return; // one session at a time
    // …in ANY tab: the repo is the cross-tab truth. Adopt instead of
    // creating a second running row.
    const elsewhere = this.sessions.running();
    if (elsewhere) {
      this.adoptRow(elsewhere);
      return;
    }
    const row = await this.sessions.start(nodeId, minutes);
    this.celebrated = false;
    this.state.set({
      nodeId,
      plannedMinutes: minutes,
      startedAt: row.startedAt,
      pausedAt: null,
      accumulatedPausedMs: 0,
      sessionId: row.id,
    });
    this.startTicker();
  }

  pause(): void {
    const active = this.state();
    if (!active || active.pausedAt !== null) return;
    this.stopTicker(); // elapsed is frozen while paused; no tick needed
    const pausedAt = Date.now();
    this.state.set({ ...active, pausedAt });
    // Persist the pause: a reload used to re-adopt with the pause erased,
    // silently converting the whole paused span into "worked" minutes.
    void this.persistPause(active.sessionId, pausedAt, active.accumulatedPausedMs);
  }

  resume(): void {
    const active = this.state();
    if (!active || active.pausedAt === null) return;
    const accumulated = active.accumulatedPausedMs + (Date.now() - active.pausedAt);
    this.state.set({
      ...active,
      pausedAt: null,
      accumulatedPausedMs: accumulated,
    });
    this.startTicker();
    void this.persistPause(active.sessionId, null, accumulated);
  }

  private async persistPause(
    sessionId: string,
    pausedAt: number | null,
    pausedMs: number,
  ): Promise<void> {
    const row = this.sessions.byId().get(sessionId);
    if (row && row.endedAt === null) {
      await this.sessions.save({ ...row, pausedAt, pausedMs });
    }
  }

  /** Ends with care and returns whole minutes (min 1) for the caller's toast. */
  async finish(): Promise<number> {
    const active = this.state();
    if (!active) return 0;
    const minutes = Math.max(1, Math.round(this.elapsedMs() / 60_000));
    // A finish while paused folds the open pause into the final tally so
    // the stored row's timestamps stay honest for totalMinutesFor.
    const finalPausedMs =
      active.accumulatedPausedMs + (active.pausedAt !== null ? Date.now() - active.pausedAt : 0);
    this.stopTicker();
    this.state.set(null); // overtime → false clears the 🌸 via the effect
    const row = this.sessions.byId().get(active.sessionId);
    if (row && row.endedAt === null) {
      await this.sessions.end({ ...row, pausedAt: null, pausedMs: finalPausedMs });
    }
    return minutes;
  }

  /** Reload persistence for free: the running row already lives in IndexedDB. */
  private adoptOrphan(): void {
    const orphan = this.sessions.running();
    if (!orphan) return;
    if (Date.now() - orphan.startedAt > ADOPT_WINDOW_MS) {
      // Yesterday's tab: close it honestly at its planted end, silently.
      void this.sessions.save({
        ...orphan,
        endedAt: Math.min(Date.now(), orphan.startedAt + orphan.plannedMinutes * 60_000),
      });
      return;
    }
    this.adoptRow(orphan);
    this.toast.show({ message: this.i18n.t().timer.resumed });
  }

  /** Rebuild in-memory state from a persisted running row — pause included
   *  (a reload used to zero the pause and count it as worked time). */
  private adoptRow(row: {
    id: string;
    nodeId: string | null;
    plannedMinutes: number;
    startedAt: number;
    pausedAt?: number | null;
    pausedMs?: number;
  }): void {
    const pausedAt = row.pausedAt ?? null;
    const accumulatedPausedMs = row.pausedMs ?? 0;
    // No surprise completion toast at adoption if it's already overtime —
    // NET of pauses, or a long-paused short session would celebrate early.
    const netElapsed =
      (pausedAt ?? Date.now()) - row.startedAt - accumulatedPausedMs;
    this.celebrated = netElapsed >= row.plannedMinutes * 60_000;
    this.state.set({
      nodeId: row.nodeId,
      plannedMinutes: row.plannedMinutes,
      startedAt: row.startedAt,
      pausedAt,
      accumulatedPausedMs,
      sessionId: row.id,
    });
    if (pausedAt === null) this.startTicker();
  }

  private startTicker(): void {
    if (this.ticker) return;
    this.now.set(Date.now()); // immediate refresh — no 1s stale frame
    this.ticker = setInterval(() => this.now.set(Date.now()), 1000);
  }

  private stopTicker(): void {
    if (this.ticker) {
      clearInterval(this.ticker);
      this.ticker = null;
    }
  }
}
