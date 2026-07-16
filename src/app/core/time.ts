import { signal } from '@angular/core';

/**
 * Date-only helpers. Gentle deadlines are 'YYYY-MM-DD' strings compared
 * lexicographically against local-today — NEVER constructed into Date
 * objects (new Date('YYYY-MM-DD') parses as UTC and shifts a day).
 *
 * `today()` is REACTIVE: it reads a module signal that flips at midnight,
 * so every day-keyed computed (ramas de hoy, date reviews, «Otra idea»)
 * follows the sun instead of the last navigation. A tab left open on
 * /ahora used to keep showing yesterday's intentions at 9am.
 */

function computeToday(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const todayState = signal(computeToday());
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const t = computeToday();
    if (t !== todayState()) todayState.set(t);
  }, 30_000);
}

export function today(): string {
  return todayState();
}

/** Local day ('YYYY-MM-DD') of an epoch-ms stamp — the ONE conversion
 *  (it used to be hand-copied in daily-paths, ahora and now almanac). */
export function dayOf(epochMs: number): string {
  const d = new Date(epochMs);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** True when the date-only string is strictly before local today. */
export function isPast(date: string): boolean {
  return date < today();
}

/** Days between a date string and today (negative = past). Safe day math via UTC noon. */
export function daysFromToday(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  const target = Date.UTC(y, m - 1, d, 12);
  const [ty, tm, td] = today().split('-').map(Number);
  const base = Date.UTC(ty, tm - 1, td, 12);
  return Math.round((target - base) / 86_400_000);
}

/* ── ritual-cadence helpers (0.0.103 «las piedritas») — all pure string-date
   math via the UTC-noon trick; never new Date('YYYY-MM-DD') directly. ── */

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

/** Weekday token of a date-only string. */
export function weekdayOf(date: string): (typeof WEEKDAYS)[number] {
  const [y, m, d] = date.split('-').map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay()];
}

/** Date-only string n days away (n may be negative). */
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n, 12));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}

/** The Monday of a date's ISO week — the weekly-ritual reset line. Hardcoded
 *  Monday (a rule you can read), never locale-dependent. */
export function mondayOf(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay(); // 0=sun
  return addDays(date, dow === 0 ? -6 : 1 - dow);
}
