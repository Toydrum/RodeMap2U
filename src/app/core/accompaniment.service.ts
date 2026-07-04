import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { I18nService } from './i18n/i18n.service';
import { SettingsService } from './repos/settings.service';
import { FocusSessionService } from './focus-session.service';
import { ToastService } from '../shared/ui/toast.service';
import { hash } from '../features/forest/tree-layout';

/**
 * Whispers: the accompaniment rhythm. A whisper is always an ORIENTATION
 * QUESTION — "¿dónde sientes que estás?" — never a task, never a name of
 * work, never a count. Tapping one lands on the check-in, whose steps ARE
 * the answer (weather → where → notita). Opt-in, silent, waking hours
 * only, never during a session, never right after a check-in.
 *
 * Honest limitation (no backend): whispers live while the app is open
 * somewhere — a background tab or an open PWA. A fully closed app stays
 * silent until it breathes again.
 */
const CHECK_EVERY_MS = 60_000;
const AFTER_CHECKIN_QUIET_MS = 3 * 60 * 60 * 1000;
const WAKING = { from: 9, until: 21 };

const RHYTHM_MS: Record<'often' | 'sometimes' | 'daily', number> = {
  often: 2 * 60 * 60 * 1000,
  sometimes: 4 * 60 * 60 * 1000,
  daily: 20 * 60 * 60 * 1000,
};

const QUESTION_KEYS = ['q1', 'q2', 'q3', 'q4', 'q5'] as const;

@Injectable({ providedIn: 'root' })
export class AccompanimentService {
  private readonly settings = inject(SettingsService);
  private readonly focus = inject(FocusSessionService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);

  init(): void {
    setInterval(() => void this.check(), CHECK_EVERY_MS);
    // Session-only demo/test override, same spirit as ?mood= / ?seed=.
    if (new URLSearchParams(location.search).get('whisper') === 'now') {
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
    // Varying interval (±25%, deterministic per day) — fixed pings go blind.
    const base = RHYTHM_MS[s.whisperRhythm];
    const jitter = ((hash(new Date().toDateString()) % 51) - 25) / 100;
    const interval = base * (1 + jitter * 0.5);
    if (s.lastWhisperAt !== null && now - s.lastWhisperAt < interval) return;
    await this.whisper();
  }

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
        await reg?.showNotification(question, {
          body: t.body,
          tag: 'rodemap-whisper',
          silent: true,
          icon: 'icons/icon-192x192.png',
          badge: 'icons/icon-96x96.png',
        });
      } catch {
        /* notification surface unavailable — the next visible moment will toast */
      }
    } else {
      return; // hidden and no permission — stay quiet, never nag about nagging
    }
    await this.settings.patch({ lastWhisperAt: Date.now() });
  }
}
