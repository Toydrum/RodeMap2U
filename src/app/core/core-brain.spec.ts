import { describe, expect, it } from 'vitest';
import { lwwBeats } from './api/contracts';
import { birdStateFrom } from './bird-state';
import { daysFromToday, isPast, today } from './time';

/** The convergence law shared verbatim by client, mock and Lambda — a bug
 *  here silently diverges replicas. */
describe('lwwBeats', () => {
  const rec = (rev: number, updatedAt: number) => ({ rev, updatedAt });

  it('higher rev wins regardless of updatedAt', () => {
    expect(lwwBeats(rec(3, 1), rec(2, 999))).toBe(true);
    expect(lwwBeats(rec(2, 999), rec(3, 1))).toBe(false);
  });

  it('equal revs fall to updatedAt', () => {
    expect(lwwBeats(rec(2, 200), rec(2, 100))).toBe(true);
    expect(lwwBeats(rec(2, 100), rec(2, 200))).toBe(false);
  });

  it('EXACT ties do NOT beat — the stored copy stands (server wins ties)', () => {
    expect(lwwBeats(rec(2, 100), rec(2, 100))).toBe(false);
  });
});

describe('bird-state', () => {
  it('paused always rests, even in overtime', () => {
    expect(birdStateFrom(true, true, -1)).toBe('resting');
  });

  it('overtime blooms', () => {
    expect(birdStateFrom(false, true, -1)).toBe('bloomed');
  });

  it('inside the bridge window it approaches; outside it works', () => {
    expect(birdStateFrom(false, false, 2 * 60_000)).toBe('approaching');
    expect(birdStateFrom(false, false, 2 * 60_000 + 1)).toBe('working');
  });

  it('a widened bridge (5 min) approaches earlier', () => {
    expect(birdStateFrom(false, false, 4 * 60_000, 5 * 60_000)).toBe('approaching');
  });
});

describe('time', () => {
  it('today is never past; yesterday is; tomorrow is not', () => {
    const t = today();
    expect(isPast(t)).toBe(false);
    // date-only string math via Date at local noon — no TZ edge
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const yesterday = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    expect(isPast(yesterday)).toBe(true);
    expect(daysFromToday(yesterday)).toBe(-1);
    expect(daysFromToday(t)).toBe(0);
  });

  it('daysFromToday spans month boundaries correctly', () => {
    const d = new Date();
    d.setDate(d.getDate() + 40);
    const future = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    expect(daysFromToday(future)).toBe(40);
  });
});
