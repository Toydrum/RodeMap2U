import { TreeNode, Weekday } from './db/schema';
import { addDays, dayOf, mondayOf, weekdayOf } from './time';

/**
 * «Las piedritas» (0.0.103) — the ritual cadence brain. Pure functions only
 * (vitest lives beside it); NO Angular, NO repos.
 *
 * A cadence is 'daily' (every morning) · 'weekly' (once a week, ANY day —
 * the low-pressure cadence; the week turns on Monday) · Weekday[] (only
 * those days). `cadenceOf` is the ONE reader of the raw fields — every
 * surface, sweep and predicate goes through it, so legacy `repeatsDaily`
 * records keep working forever without a migration pass.
 *
 * The invariant the whole app leans on: surfaces never compute period
 * membership — the LIVE STATUS is «done this period», because the sweep
 * (rituals.service.ts) is the one clock that resets it.
 */
export type Cadence = 'daily' | 'weekly' | Weekday[];

/** The one reader: explicit `repeats` wins (null = cleared); otherwise the
 *  legacy daily boolean. Returns null for «no rhythm». An EMPTY weekday
 *  list normalizes to null (0.0.115 B2): `[]` is truthy — it used to
 *  classify as a ritual (fruit suppressed) that reset daily through the
 *  "unreachable" fallback. The UI can't produce it; sync/import could. */
export function cadenceOf(n: TreeNode): Cadence | null {
  if (n.repeats !== undefined) {
    if (Array.isArray(n.repeats) && n.repeats.length === 0) return null;
    return n.repeats;
  }
  return n.repeatsDaily ? 'daily' : null;
}

/** Is the ritual scheduled to walk on this date? 'weekly' is walkable any
 *  day of its week. */
export function isScheduledOn(c: Cadence, date: string): boolean {
  if (c === 'daily' || c === 'weekly') return true;
  return c.includes(weekdayOf(date));
}

/** The most recent scheduled day on or before today — the start of the
 *  CURRENT period. A bloom stamped before it belongs to a previous period. */
export function lastScheduledOnOrBefore(c: Cadence, today: string): string {
  if (c === 'daily') return today;
  if (c === 'weekly') return mondayOf(today);
  for (let i = 0; i < 7; i++) {
    const d = addDays(today, -i);
    if (c.includes(weekdayOf(d))) return d;
  }
  return today; // unreachable with a non-empty Weekday[]
}

/** Should a bloom stamped at `achievedAt` reset this morning? For 'daily'
 *  this reduces byte-equal to the classic sendero rule
 *  (dayOf(achievedAt) < today). */
export function shouldReset(c: Cadence, achievedAt: number, today: string): boolean {
  return dayOf(achievedAt) < lastScheduledOnOrBefore(c, today);
}

/** «La historia se queda» (0.0.106): a bloom stamped BEFORE the day the
 *  cadence was set is FROZEN HISTORY — the sweep never resets it, the month
 *  keeps its mark, the caminito walks only what came after. Day-boundary on
 *  purpose: a bloom from the conversion day itself belongs to the ritual's
 *  first period (it resets next period, the natural «hice esto hoy, quiero
 *  repetirlo» flow). Legacy rituals lack repeatsSetAt ≡ nothing frozen. */
export function frozenBeforeCadence(achievedAt: number, ritual: TreeNode): boolean {
  return ritual.repeatsSetAt != null && dayOf(achievedAt) < dayOf(ritual.repeatsSetAt);
}

/** The next scheduled day strictly after today — for the gentle rest line
 *  («vuelve el jueves»). 'daily'/'weekly' rituals never rest. */
export function nextScheduledAfter(c: Cadence, today: string): string | null {
  if (c === 'daily' || c === 'weekly') return null;
  for (let i = 1; i <= 7; i++) {
    const d = addDays(today, i);
    if (c.includes(weekdayOf(d))) return d;
  }
  return null;
}
