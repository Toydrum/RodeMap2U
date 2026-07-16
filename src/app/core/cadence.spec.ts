import { describe, expect, it } from 'vitest';
import { TreeNode } from './db/schema';
import {
  cadenceOf,
  isScheduledOn,
  lastScheduledOnOrBefore,
  nextScheduledAfter,
  shouldReset,
} from './cadence';

// 2026-07-16 is a Thursday; 2026-07-13 the Monday of its week.
const THU = '2026-07-16';
const MON = '2026-07-13';

/** Epoch ms at local noon of a date-only string (mirrors how achievedAt is
 *  stamped: Date.now() during the day). */
function atNoon(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, 12).getTime();
}

function node(fields: Partial<TreeNode>): TreeNode {
  return {
    id: 'n1',
    createdAt: 1,
    updatedAt: 1,
    rev: 1,
    deletedAt: null,
    treeId: 't1',
    parentId: null,
    title: 'x',
    note: '',
    status: 'growing',
    order: 1,
    targetDate: null,
    achievedAt: null,
    branchedAt: null,
    origin: 'planned',
    archivedAt: null,
    ...fields,
  } as TreeNode;
}

describe('cadenceOf — the ONE reader (legacy repeatsDaily keeps working)', () => {
  it('reads explicit repeats', () => {
    expect(cadenceOf(node({ repeats: 'weekly' }))).toBe('weekly');
    expect(cadenceOf(node({ repeats: ['tue'] }))).toEqual(['tue']);
  });
  it('explicit null CLEARS even over a legacy true', () => {
    expect(cadenceOf(node({ repeats: null, repeatsDaily: true }))).toBeNull();
  });
  it('legacy repeatsDaily fallback when repeats is absent', () => {
    expect(cadenceOf(node({ repeatsDaily: true }))).toBe('daily');
    expect(cadenceOf(node({}))).toBeNull();
  });
});

describe('isScheduledOn', () => {
  it('daily and weekly walk any day', () => {
    expect(isScheduledOn('daily', THU)).toBe(true);
    expect(isScheduledOn('weekly', THU)).toBe(true);
  });
  it('weekday lists only their days', () => {
    expect(isScheduledOn(['thu'], THU)).toBe(true);
    expect(isScheduledOn(['tue'], THU)).toBe(false);
  });
});

describe('lastScheduledOnOrBefore — the start of the current period', () => {
  it('daily → today (the classic sendero rule)', () => {
    expect(lastScheduledOnOrBefore('daily', THU)).toBe(THU);
  });
  it('weekly → the Monday of this week (incl. Sunday edge)', () => {
    expect(lastScheduledOnOrBefore('weekly', THU)).toBe(MON);
    expect(lastScheduledOnOrBefore('weekly', '2026-07-19')).toBe(MON); // Sunday
    expect(lastScheduledOnOrBefore('weekly', MON)).toBe(MON);
  });
  it('weekday list → the most recent listed day', () => {
    expect(lastScheduledOnOrBefore(['tue'], THU)).toBe('2026-07-14');
    expect(lastScheduledOnOrBefore(['thu'], THU)).toBe(THU);
  });
});

describe('shouldReset — the sweep clock', () => {
  it('daily: yesterday resets, today does not (byte-equal to the old sweep)', () => {
    expect(shouldReset('daily', atNoon('2026-07-15'), THU)).toBe(true);
    expect(shouldReset('daily', atNoon(THU), THU)).toBe(false);
  });
  it('weekly: last week resets on Monday crossing; this week holds all week', () => {
    expect(shouldReset('weekly', atNoon('2026-07-12'), THU)).toBe(true); // last Sunday
    expect(shouldReset('weekly', atNoon(MON), THU)).toBe(false); // Monday bloom holds Thursday
  });
  it('tue-only: a Tuesday bloom lingers Wednesday…Monday and resets next Tuesday', () => {
    const tueBloom = atNoon('2026-07-14');
    expect(shouldReset(['tue'], tueBloom, '2026-07-15')).toBe(false); // Wednesday: lingers
    expect(shouldReset(['tue'], tueBloom, '2026-07-20')).toBe(false); // next Monday: still
    expect(shouldReset(['tue'], tueBloom, '2026-07-21')).toBe(true); // next Tuesday: dawns clean
  });
  it('tue-only walk-ahead: a Monday bloom resets Tuesday morning (no special cases)', () => {
    expect(shouldReset(['tue'], atNoon(MON), '2026-07-14')).toBe(true);
  });
});

describe('nextScheduledAfter — the gentle rest line', () => {
  it('daily/weekly never rest', () => {
    expect(nextScheduledAfter('daily', THU)).toBeNull();
    expect(nextScheduledAfter('weekly', THU)).toBeNull();
  });
  it('tue-only on Thursday → next Tuesday', () => {
    expect(nextScheduledAfter(['tue'], THU)).toBe('2026-07-21');
  });
});
