import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { SessionsRepo } from './repos/sessions.repo';
import { ToastService } from '../shared/ui/toast.service';
import { I18nService } from './i18n/i18n.service';

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

  readonly display = computed(() => {
    const total = Math.floor(this.elapsedMs() / 1000);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  });

  constructor() {
    this.adoptOrphan();

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
    this.state.set({ ...active, pausedAt: Date.now() });
  }

  resume(): void {
    const active = this.state();
    if (!active || active.pausedAt === null) return;
    this.state.set({
      ...active,
      pausedAt: null,
      accumulatedPausedMs: active.accumulatedPausedMs + (Date.now() - active.pausedAt),
    });
    this.startTicker();
  }

  /** Ends with care and returns whole minutes (min 1) for the caller's toast. */
  async finish(): Promise<number> {
    const active = this.state();
    if (!active) return 0;
    const minutes = Math.max(1, Math.round(this.elapsedMs() / 60_000));
    this.stopTicker();
    this.state.set(null); // overtime → false clears the 🌸 via the effect
    const row = this.sessions.byId().get(active.sessionId);
    if (row && row.endedAt === null) await this.sessions.end(row);
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
    // No surprise completion toast at boot if it's already overtime.
    this.celebrated = Date.now() - orphan.startedAt >= orphan.plannedMinutes * 60_000;
    this.state.set({
      nodeId: orphan.nodeId,
      plannedMinutes: orphan.plannedMinutes,
      startedAt: orphan.startedAt,
      pausedAt: null,
      accumulatedPausedMs: 0,
      sessionId: orphan.id,
    });
    this.startTicker();
    this.toast.show({ message: this.i18n.t().timer.resumed });
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
