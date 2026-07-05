import { AccentToken } from '../../core/db/schema';

/**
 * "Cada árbol su porte": the accent chosen at planting also defines the
 * tree's SILHOUETTE personality — how its trunk winds, how hard its limbs
 * reach for the sky, and how its foliage gathers. Three archetypes (a round
 * dense oak, a sinuous flat-padded acacia, a slender vertical) dialed per
 * accent. Deterministic, botanical, and a little bit magical — the same
 * spirit as flora.ts, one file over.
 */

export type FoliageMode = 'padsAndLeaves' | 'padsOnly' | 'sparsePads';

export interface TreeForm {
  id: 'oak' | 'acacia' | 'slender';
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

/** Each accent dials an archetype — every color grows recognizably its own. */
const FORMS: Record<AccentToken, TreeForm> = {
  moss: { ...OAK, girthMul: 1.12, bowMul: 0.9 },
  rose: { ...OAK, girthMul: 1.05, bowMul: 1.0 },
  sage: { ...OAK, girthMul: 1.0, bowMul: 0.8 },
  clay: { ...ACACIA, girthMul: 0.95, bowMul: 1.35 },
  sand: { ...ACACIA, girthMul: 0.9, bowMul: 1.5 },
  sky: { ...SLENDER, girthMul: 0.8, bowMul: 0.65 },
  lavender: { ...SLENDER, girthMul: 0.85, bowMul: 0.75 },
  pine: { ...SLENDER, girthMul: 0.9, bowMul: 0.55 },
};

export function formFor(accent: AccentToken): TreeForm {
  return FORMS[accent] ?? FORMS.moss;
}
