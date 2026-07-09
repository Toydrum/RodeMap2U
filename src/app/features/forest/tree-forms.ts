import { AccentToken } from '../../core/db/schema';
import { hash } from './tree-layout';

/**
 * "Cada árbol su porte": the accent chosen at planting also defines the
 * tree's SILHOUETTE personality — how its trunk winds, how hard its limbs
 * reach for the sky, and how its foliage gathers. Six archetypes (round
 * dense oak, flat-padded acacia, slender vertical, weeping willow, zigzag
 * pale birch, tiered conifer) dialed per accent — and since 0.0.61 every
 * tree adds its OWN deterministic jitter on top (hash of the tree id), so
 * two same-accent trees are siblings, never twins. Deterministic, botanical,
 * and a little bit magical — the same spirit as flora.ts, one file over.
 */

export type FoliageMode = 'padsAndLeaves' | 'padsOnly' | 'sparsePads';

/** Render-side growth habits — they bend how limbs are DRAWN in limbPlan
 *  (and echo in the minis), never where nodes sit. */
export type TreeHabit = 'weeping' | 'zigzag' | 'tiered';

export interface TreeForm {
  id: 'oak' | 'acacia' | 'slender' | 'willow' | 'birch' | 'conifer';
  /** 0..1 — how hard the leader edge calms toward a continuing trunk line. */
  leaderBias: number;
  /** Side branches fork off the leader limb inside this t-window. */
  forkTMin: number;
  forkTMax: number;
  /** Multiplies the tree's wood.bow on non-leader edges (sinuosity). */
  bowMul: number;
  /** 0..1 — arrival tangents mixed toward straight-up (limbs curve skyward). */
  upBias: number;
  /** Multiplies wood.girth inside the mass-width law. */
  girthMul: number;
  foliage: FoliageMode;
  padCount: [number, number];
  padRx: [number, number];
  padRy: [number, number];
  /** Cluster scatter radius around a branch tip. */
  padSpread: number;
  /** Scales the distributed leaves along limbs (acacia keeps air between pads). */
  leafDensityMul: number;
  habit?: TreeHabit;
  /** Birch identity: mixes a pale wash into the bark family. */
  barkTint?: 'pale';
}

const OAK: Omit<TreeForm, 'girthMul' | 'bowMul'> = {
  id: 'oak',
  leaderBias: 0.5,
  forkTMin: 0.3,
  forkTMax: 0.75,
  upBias: 0.45,
  foliage: 'padsAndLeaves',
  padCount: [3, 4],
  padRx: [9, 14],
  padRy: [7, 11],
  padSpread: 10,
  leafDensityMul: 1,
};

const ACACIA: Omit<TreeForm, 'girthMul' | 'bowMul'> = {
  id: 'acacia',
  leaderBias: 0.3,
  forkTMin: 0.45,
  forkTMax: 0.85,
  upBias: 0.35,
  foliage: 'padsOnly',
  padCount: [4, 6],
  padRx: [12, 18],
  padRy: [4.5, 7],
  padSpread: 15,
  leafDensityMul: 0.35,
};

const SLENDER: Omit<TreeForm, 'girthMul' | 'bowMul'> = {
  id: 'slender',
  leaderBias: 0.85,
  forkTMin: 0.25,
  forkTMax: 0.6,
  upBias: 0.7,
  foliage: 'sparsePads',
  padCount: [1, 2],
  padRx: [6, 9],
  padRy: [5, 8],
  padSpread: 6,
  leafDensityMul: 0.55,
};

/** Weeping willow: lush, low-slung, tips that HANG (habit relaxes the
 *  upward clamp on tip limbs). */
const WILLOW: Omit<TreeForm, 'girthMul' | 'bowMul'> = {
  id: 'willow',
  leaderBias: 0.55,
  forkTMin: 0.2,
  forkTMax: 0.6,
  upBias: 0.18,
  foliage: 'padsAndLeaves',
  padCount: [2, 4],
  padRx: [7, 11],
  padRy: [9, 14],
  padSpread: 9,
  leafDensityMul: 1.25,
  habit: 'weeping',
};

/** Birch: pale bark, airy sparse crown, a trunk that kinks side to side
 *  (habit alternates the leader hand by depth). */
const BIRCH: Omit<TreeForm, 'girthMul' | 'bowMul'> = {
  id: 'birch',
  leaderBias: 0.8,
  forkTMin: 0.22,
  forkTMax: 0.55,
  upBias: 0.62,
  foliage: 'sparsePads',
  padCount: [2, 3],
  padRx: [7, 10],
  padRy: [6, 9],
  padSpread: 8,
  leafDensityMul: 0.7,
  habit: 'zigzag',
  barkTint: 'pale',
};

/** Conifer: one strong leader, flat wide pads in shelves, side limbs that
 *  sweep out-and-slightly-down (habit tiers the fork arrivals). */
const CONIFER: Omit<TreeForm, 'girthMul' | 'bowMul'> = {
  id: 'conifer',
  leaderBias: 0.95,
  forkTMin: 0.15,
  forkTMax: 0.9,
  upBias: 0.8,
  foliage: 'padsOnly',
  padCount: [3, 5],
  padRx: [10, 16],
  padRy: [3, 5],
  padSpread: 12,
  leafDensityMul: 0.45,
  habit: 'tiered',
};

/** Each accent dials an archetype — every color grows recognizably its own.
 *  (0.0.61 remap, owner-consented: sage→willow, sky→birch, pine→conifer —
 *  existing trees of those accents changed silhouette exactly once.) */
const FORMS: Record<AccentToken, TreeForm> = {
  moss: { ...OAK, girthMul: 1.12, bowMul: 0.9 },
  rose: { ...OAK, girthMul: 1.05, bowMul: 1.0 },
  sage: { ...WILLOW, girthMul: 1.0, bowMul: 1.3 },
  clay: { ...ACACIA, girthMul: 0.95, bowMul: 1.35 },
  sand: { ...ACACIA, girthMul: 0.9, bowMul: 1.5 },
  sky: { ...BIRCH, girthMul: 0.78, bowMul: 0.7 },
  lavender: { ...SLENDER, girthMul: 0.85, bowMul: 0.75 },
  pine: { ...CONIFER, girthMul: 0.95, bowMul: 0.4 },
};

/** −range..+range from a per-tree salt (rule 4: hash, never Math.random). */
function jit(treeId: string, salt: string, range: number): number {
  return ((hash(treeId + salt) % 1000) / 1000 - 0.5) * 2 * range;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * The accent picks the FAMILY; the tree id picks the individual. Same-accent
 * trees now differ in fork windows, sky-reach, pad spread and leaf density —
 * siblings, never twins. Omit `treeId` for the base form (mini call sites
 * pass it; girth/bow stay `wood()`'s job — no double jitter).
 */
export function formFor(accent: AccentToken, treeId?: string): TreeForm {
  const base = FORMS[accent] ?? FORMS.moss;
  if (!treeId) return base;
  const shift = jit(treeId, ':f-fork', 0.06);
  const forkTMin = clamp(base.forkTMin + shift, 0.1, 0.72);
  const forkTMax = clamp(base.forkTMax + shift, forkTMin + 0.2, 0.92);
  return {
    ...base,
    upBias: clamp(base.upBias + jit(treeId, ':f-up', 0.08), 0.05, 0.9),
    leaderBias: clamp(base.leaderBias + jit(treeId, ':f-lead', 0.1), 0.1, 0.95),
    forkTMin,
    forkTMax,
    padSpread: base.padSpread * (1 + jit(treeId, ':f-spread', 0.2)),
    leafDensityMul: base.leafDensityMul * (1 + jit(treeId, ':f-leafd', 0.15)),
    padCount: [base.padCount[0], base.padCount[1] + (hash(treeId + ':f-pad') % 2)],
  };
}
