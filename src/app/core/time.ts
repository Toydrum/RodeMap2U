/**
 * Date-only helpers. Gentle deadlines are 'YYYY-MM-DD' strings compared
 * lexicographically against local-today — NEVER constructed into Date
 * objects (new Date('YYYY-MM-DD') parses as UTC and shifts a day).
 */

export function today(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
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
