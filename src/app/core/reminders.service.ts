import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { I18nService } from './i18n/i18n.service';
import { TreesRepo } from './repos/trees.repo';
import { NodesRepo } from './repos/nodes.repo';
import { FocusSessionService } from './focus-session.service';
import { ToastService } from '../shared/ui/toast.service';
import { TreeNode } from './db/schema';
import { cadenceOf, isScheduledOn } from './cadence';
import { today } from './time';
import { get, put } from './db/idb';

/**
 * «La campanita» (0.0.111) — per-branch reminders, owner + psychologist
 * override of the old no-reminders law. The philosophical line that keeps
 * it in the house: the reminder re-speaks the USER'S OWN cuando-entonces
 * phrase (or the branch title) at the USER'S OWN chosen hour — the app
 * still decides nothing, values nothing, schedules nothing of its own.
 *
 * Rules: once per day per branch · silent (never sound/vibration) · live
 * branches in live trees only (resting/achieved/branched stay quiet) · a
 * ritual with weekday cadence reminds only on its scheduled days · never
 * during a focus session, never over the check-in ritual · ≤60 min late
 * grace (opening the app long after the hour stays QUIET until tomorrow —
 * a stale reminder is noise, not orientation).
 *
 * Honest floor (same as whispers, no push backend): it lives while the app
 * is open somewhere — a background tab or an open PWA. The fired-marker is
 * DEVICE state (meta store, never synced, never in backups): each device
 * with the app open may remind once — the notification `tag` dedups.
 */
const CHECK_EVERY_MS = 30_000;
const LATE_GRACE_MS = 60 * 60 * 1000;
const FIRED_KEY = 'reminders.fired';

@Injectable({ providedIn: 'root' })
export class RemindersService {
  private readonly trees = inject(TreesRepo);
  private readonly nodes = inject(NodesRepo);
  private readonly focus = inject(FocusSessionService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);

  /** nodeId → 'YYYY-MM-DD' of the last fire on THIS device. Re-read from
   *  the meta row on EVERY check (0.0.115 M2): two tabs each hold their own
   *  timer — a stale in-memory map fired the same reminder twice a day. */
  private fired = new Map<string, string>();

  private started = false;

  init(): void {
    // Idempotent (0.0.115 P2): a second caller must not stack a second
    // interval — double timers means double chimes forever.
    if (this.started) return;
    this.started = true;
    setInterval(() => void this.check(), CHECK_EVERY_MS);
    // Late-fire on open: the boot check catches an hour that passed while
    // the app was closed (within the grace window).
    setTimeout(() => void this.check(), 4_000);
  }

  /** Setting an hour is the opt-in gesture — ask for the notification
   *  permission right there (in-app toasts work even if denied). */
  async ensurePermission(): Promise<void> {
    if ('Notification' in window && Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch {
        /* unsupported — in-app reminders still work */
      }
    }
  }

  private async loadFired(): Promise<void> {
    try {
      const row = await get<{ key: string; days?: Record<string, string> }>('meta', FIRED_KEY);
      for (const [id, day] of Object.entries(row?.days ?? {})) {
        // Disk marks MERGE over memory (another tab may have fired first);
        // memory keeps marks the disk write hasn't landed yet.
        if (!this.fired.has(id)) this.fired.set(id, day);
      }
    } catch {
      /* storage unavailable — in-memory dedup still holds this session */
    }
  }

  private async persistFired(): Promise<void> {
    try {
      // MERGE with the disk row (never clobber a sibling tab's marks), and
      // only today's marks travel — yesterday's are spent anyway.
      const day = today();
      const row = await get<{ key: string; days?: Record<string, string> }>('meta', FIRED_KEY);
      const days: Record<string, string> = {};
      for (const [id, d] of Object.entries(row?.days ?? {})) if (d === day) days[id] = d;
      for (const [id, d] of this.fired) if (d === day) days[id] = d;
      await put('meta', { key: FIRED_KEY, days });
    } catch {
      /* best-effort */
    }
  }

  private async check(): Promise<void> {
    await this.loadFired();
    if (this.focus.active()) return; // a session is already company
    if (this.router.url.startsWith('/check-in')) return; // never over the ritual
    const day = today();
    const now = Date.now();
    const liveTrees = new Set(this.trees.active().map((t) => t.id));
    for (const node of this.nodes.visible()) {
      if (!node.remindAt || !liveTreeHolds(liveTrees, node)) continue;
      if (node.status !== 'seed' && node.status !== 'growing') continue;
      const cadence = cadenceOf(node);
      if (cadence && !isScheduledOn(cadence, day)) continue; // rituals rest on their off-days
      if (this.fired.get(node.id) === day) continue;
      const at = todayAt(node.remindAt);
      if (at === null || now < at || now - at > LATE_GRACE_MS) continue;
      // Mark fired ONLY when something was actually shown (the whisper
      // honesty rule) — hidden-without-permission re-tries next check and
      // the ≤1h grace lets the toast greet a soon-returning user.
      if (!(await this.fire(node))) continue;
      this.fired.set(node.id, day);
      await this.persistFired();
      return; // one reminder per check — two branches at the same hour take turns
    }
  }

  private async fire(node: TreeNode): Promise<boolean> {
    const t = this.i18n.t().reminders;
    const phrase = node.trigger?.trim();
    const message = phrase
      ? this.i18n.fill(t.withPhrase, { trigger: phrase, title: node.title })
      : this.i18n.fill(t.plain, { title: node.title });
    const open = () => void this.router.navigate(['/tree', node.treeId], { queryParams: { node: node.id } });

    if (document.visibilityState === 'visible') {
      this.toast.show({ message, actionLabel: t.action, action: open }, 12_000);
      return true;
    }
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const reg = await navigator.serviceWorker?.getRegistration();
        if (!reg) return false;
        await reg.showNotification(message, {
          body: t.body,
          tag: 'roadmap-reminder-' + node.id,
          silent: true,
          icon: 'icons/icon-192x192.png',
          badge: 'icons/icon-96x96.png',
          data: { url: `./tree/${node.treeId}?node=${node.id}` },
        });
        return true;
      } catch {
        return false; // nothing shown — don't mark fired, the next check re-tries
      }
    }
    // Hidden and no permission: stay quiet; the ≤1h grace lets the toast
    // greet the user if they come back soon.
    return false;
  }
}

/** Epoch-ms of today's 'HH:MM' (local), or null for a malformed value.
 *  Range-checked (0.0.115 B3): '25:30' passed the regex and setHours rolled
 *  it to TOMORROW — the reminder never rang and never marked, silently. */
function todayAt(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  const d = new Date();
  d.setHours(h, min, 0, 0);
  return d.getTime();
}

function liveTreeHolds(liveTrees: Set<string>, node: TreeNode): boolean {
  return liveTrees.has(node.treeId);
}
