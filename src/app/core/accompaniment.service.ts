import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { I18nService } from './i18n/i18n.service';
import { SettingsService } from './repos/settings.service';
import { TreesRepo } from './repos/trees.repo';
import { NodesRepo } from './repos/nodes.repo';
import { SessionsRepo } from './repos/sessions.repo';
import { CheckinsRepo } from './repos/checkins.repo';
import { FocusSessionService } from './focus-session.service';
import { ToastService } from '../shared/ui/toast.service';
import { today } from './time';
import { hash } from '../features/forest/tree-layout';
import { Suggestion, suggestionPool } from '../features/ahora/suggest';

/**
 * Whispers: the accompaniment rhythm, in TWO gentle beats.
 *
 * Beat one is always an ORIENTATION QUESTION — "¿dónde sientes que estás?"
 * — never a task, never a name of work, never a count. Tapping it lands on
 * the check-in, whose steps ARE the answer (weather → where → notita).
 *
 * Beat two, a little while after the question (answered or let go): ONE
 * tiny, low-energy offer — a leaf pasito with a 2-minute door. One shot,
 * dismissible, never repeated, dissolved the moment a session exists.
 *
 * Opt-in, silent, waking hours only, never during a session, never right
 * after a check-in. Honest limitation (no backend): whispers live while
 * the app is open somewhere — a background tab or an open PWA.
 */
const CHECK_EVERY_MS = 60_000;
const AFTER_CHECKIN_QUIET_MS = 3 * 60 * 60 * 1000;
const WAKING = { from: 9, until: 21 };

const RHYTHM_MS: Record<'often' | 'sometimes' | 'daily', number> = {
  often: 2 * 60 * 60 * 1000,
  sometimes: 4 * 60 * 60 * 1000,
  daily: 20 * 60 * 60 * 1000,
};
/** 'surprise': an unpredictable gap between 1.5 h and 6 h. */
const SURPRISE_MIN_MS = 90 * 60 * 1000;
const SURPRISE_RANGE_MS = 270 * 60 * 1000;

const TINY_OFFER_DELAY_MS = 45_000;
const TINY_OFFER_MAX_AGE_MS = 10 * 60 * 1000;

const QUESTION_KEYS = ['q1', 'q2', 'q3', 'q4', 'q5'] as const;

@Injectable({ providedIn: 'root' })
export class AccompanimentService {
  private readonly settings = inject(SettingsService);
  private readonly focus = inject(FocusSessionService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly trees = inject(TreesRepo);
  private readonly nodes = inject(NodesRepo);
  private readonly sessions = inject(SessionsRepo);
  private readonly checkins = inject(CheckinsRepo);

  /** A whisper fired and its tiny offer hasn't been delivered yet. */
  private pendingTinyAt: number | null = null;
  private tinyTimer: ReturnType<typeof setTimeout> | null = null;
  /** ?whisper=now test override shortens the second beat. */
  private testMode = false;

  init(): void {
    setInterval(() => void this.check(), CHECK_EVERY_MS);
    // If the question arrived as a notification, the offer waits for the return.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.pendingTinyAt !== null) {
        this.scheduleTiny(this.testMode ? 2_000 : 8_000);
      }
    });
    // Session-only demo/test override, same spirit as ?mood= / ?seed=.
    if (new URLSearchParams(location.search).get('whisper') === 'now') {
      this.testMode = true;
      setTimeout(() => void this.whisper(), 1200);
    }
  }

  /** The settings toggle calls this on enable (a user gesture — required
   *  for the permission prompt). In-app whispers work even if denied. */
  async enable(): Promise<void> {
    await this.settings.patch({ whispersEnabled: true, lastWhisperAt: Date.now() });
    if ('Notification' in window && Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch {
        /* unsupported — in-app whispers still work */
      }
    }
  }

  async disable(): Promise<void> {
    await this.settings.patch({ whispersEnabled: false });
  }

  private async check(): Promise<void> {
    const s = this.settings.settings();
    if (!s.whispersEnabled) return;
    if (this.focus.active()) return; // a session is already company
    if (this.router.url.startsWith('/check-in')) return;
    const hour = new Date().getHours();
    if (hour < WAKING.from || hour >= WAKING.until) return;
    const now = Date.now();
    if (s.lastCheckInAt !== null && now - s.lastCheckInAt < AFTER_CHECKIN_QUIET_MS) return;
    if (s.lastWhisperAt !== null && now - s.lastWhisperAt < this.interval(s.whisperRhythm, s.lastWhisperAt)) {
      return;
    }
    await this.whisper();
  }

  private interval(rhythm: 'often' | 'sometimes' | 'daily' | 'surprise', lastAt: number | null): number {
    if (rhythm === 'surprise') {
      // Unpredictable but deterministic: each whisper seeds the next gap.
      return SURPRISE_MIN_MS + (hash(today() + ':' + String(lastAt ?? 0)) % SURPRISE_RANGE_MS);
    }
    // Varying interval (±12.5%, deterministic per day) — fixed pings go blind.
    const jitter = ((hash(new Date().toDateString()) % 51) - 25) / 100;
    return RHYTHM_MS[rhythm] * (1 + jitter * 0.5);
  }

  /* --------------------------------------------------- beat one: the question */

  private async whisper(): Promise<void> {
    const t = this.i18n.t().whispers;
    const key = QUESTION_KEYS[hash(String(Math.floor(Date.now() / 3_600_000))) % QUESTION_KEYS.length];
    const question = t[key];

    if (document.visibilityState === 'visible') {
      this.toast.show(
        {
          message: question,
          actionLabel: t.answer,
          action: () => void this.router.navigate(['/check-in']),
        },
        12_000,
      );
    } else if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const reg = await navigator.serviceWorker?.getRegistration();
        if (!reg) return; // SW not ready yet — the whisper slot is NOT consumed
        await reg.showNotification(question, {
          body: t.body,
          tag: 'roadmap-whisper',
          silent: true,
          icon: 'icons/icon-192x192.png',
          badge: 'icons/icon-96x96.png',
        });
      } catch {
        // Nothing was shown — consuming the slot here armed a beat-two offer
        // whose question never existed. Try again next check.
        return;
      }
    } else {
      return; // hidden and no permission — stay quiet, never nag about nagging
    }
    await this.settings.patch({ lastWhisperAt: Date.now() });
    this.armTiny();
  }

  /* ---------------------------------------- beat two: one tiny, low-energy offer */

  private armTiny(): void {
    this.pendingTinyAt = Date.now();
    this.scheduleTiny(this.testMode ? 4_000 : TINY_OFFER_DELAY_MS);
  }

  private scheduleTiny(delayMs: number): void {
    if (this.tinyTimer) clearTimeout(this.tinyTimer);
    this.tinyTimer = setTimeout(() => this.deliverTiny(), delayMs);
  }

  private deliverTiny(): void {
    if (this.pendingTinyAt === null) return;
    if (Date.now() - this.pendingTinyAt > TINY_OFFER_MAX_AGE_MS) {
      this.pendingTinyAt = null;
      return;
    }
    if (this.focus.active()) {
      this.pendingTinyAt = null; // already working — the offer served its purpose
      return;
    }
    if (document.visibilityState !== 'visible') return; // the return re-arms it
    if (this.router.url.startsWith('/check-in')) {
      this.scheduleTiny(this.testMode ? 3_000 : 15_000); // let the ritual finish first
      return;
    }
    const tiny = this.pickTiny();
    this.pendingTinyAt = null;
    if (!tiny) return;
    const t = this.i18n.t().whispers;
    this.toast.show(
      {
        message: this.i18n.fill(t.tinyOffer, { title: tiny.node.title }),
        actionLabel: t.tinyAction,
        action: () => void this.focus.start(tiny.node.id, 2),
      },
      12_000,
    );
  }

  /** The smallest-feeling candidate: the first LEAF in the ranked pool
   *  (pasitos are concrete micro-actions by design); else the ranked best. */
  private pickTiny(): Suggestion | null {
    const intentions = this.settings.settings().todayIntentions;
    const todayIds = intentions && intentions.date === today() ? intentions.nodeIds : [];
    const pool = suggestionPool(
      this.trees.active(),
      this.nodes.byTree(),
      (n) => this.nodes.childrenOf(n),
      this.sessions.all(),
      this.checkins.all(),
      this.nodes.byId(),
      todayIds,
    );
    return pool.find((s) => this.nodes.childrenOf(s.node).length === 0) ?? pool[0] ?? null;
  }
}
