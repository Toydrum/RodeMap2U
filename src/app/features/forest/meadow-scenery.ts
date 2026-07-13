import { FlowerSpec } from './flora';
import { hash, taperedRibbon } from './tree-layout';

/**
 * The meadow's STATIC scenery (B5, 0.0.78) — every fixed-seed scatter that
 * used to pad out forest.ts. Pure data, computed once at module load, same
 * meadow every session forever (no Math.random, ever). Live pieces stay in
 * the component: `flowers` (per-achieved-goal), `hasStream`, `mood`.
 */

export interface SceneFlower {
  x: number;
  y: number;
  scale: number;
  spec: FlowerSpec;
  sway: number;
}

export interface GrassTuft {
  x: number;
  y: number;
  s: number;
  rot: number;
  variant: number;
  shade: number;
  flip: boolean;
}

export interface MeadowDecor {
  x: number;
  y: number;
  s: number;
  flip: boolean;
}

/** Fixed-seed scatter helper — items deeper in the band (higher y) grow
 *  larger: cheap depth. */
export function scatter(
  kind: string,
  count: number,
  xMin: number,
  xSpan: number,
  yMin: number,
  ySpan: number,
): MeadowDecor[] {
  return Array.from({ length: count }, (_, i) => {
    const h = hash(kind + ':' + i);
    const y = yMin + ((h >> 6) % ySpan);
    const depth = 0.62 + ((y - yMin) / ySpan) * 0.45;
    return {
      x: xMin + (h % xSpan),
      y,
      s: (0.7 + ((h >> 3) % 55) / 100) * depth,
      flip: h % 2 === 0,
    };
  });
}

/** The stream's winding ribbon + its two ripple strokes. */
export const STREAM_PATH = taperedRibbon(1060, 96, 700, 168, 400, 76, -60, 208, 22, 46);
export const RIPPLE_1 = 'M 1040 104 C 720 170, 430 92, -40 202';
export const RIPPLE_2 = 'M 1045 118 C 735 185, 445 110, -45 218';

/** Grass grows in overlapping patches of varied tufts — that's the trick
 *  that reads as real grass instead of repeated stamps. Fixed-seed. */
export const GRASS: GrassTuft[] = (() => {
  const out: GrassTuft[] = [];
  const tuft = (key: string, x: number, y: number, sBase: number): GrassTuft => {
    const h = hash(key);
    return {
      x,
      y,
      s: sBase * (0.75 + ((h >> 9) % 55) / 100),
      rot: -9 + ((h >> 4) % 19),
      variant: h % 5,
      shade: (h >> 7) % 3,
      flip: (h >> 2) % 2 === 0,
    };
  };
  // 12 dense patches: 3-6 tufts crowding one another
  for (let p = 0; p < 12; p++) {
    const hp = hash('patch:' + p);
    const cx = 40 + (hp % 920);
    const cy = 210 + ((hp >> 6) % 44);
    const members = 3 + (hp % 4);
    for (let m = 0; m < members; m++) {
      const hm = hash('patch:' + p + ':' + m);
      out.push(tuft('pt:' + p + ':' + m, cx - 26 + (hm % 53), cy - 7 + ((hm >> 5) % 15), 1));
    }
  }
  // plus lone wanderers between the patches
  for (let i = 0; i < 12; i++) {
    const h = hash('lone:' + i);
    out.push(tuft('lt:' + i, 15 + (h % 970), 206 + ((h >> 6) % 50), 0.85));
  }
  return out.sort((a, b) => a.y - b.y);
})();

/* Meadow texture — all fixed-seed, never reshuffles (references: tall
   silhouette tufts + seed-head spikes, shrubs, daisies, dappled light). */
export const SUN_PATCHES = scatter('sunpatch', 4, 80, 820, 158, 66);
export const BUSHES = scatter('bush', 9, 160, 800, 198, 42);
export const RICH_TUFTS = scatter('rich', 26, 10, 960, 198, 56);
export const SPIKES = scatter('spike', 20, 20, 950, 198, 56);
export const DAISIES = scatter('daisy', 14, 170, 790, 200, 52);
export const CLOVERS = scatter('clover', 18, 175, 790, 206, 48);

/** Hand-placed by the stream banks (only shown once the stream flows). */
export const CATTAILS: MeadowDecor[] = [
  { x: 655, y: 152, s: 1, flip: false },
  { x: 268, y: 146, s: 0.85, flip: true },
  { x: 762, y: 150, s: 0.75, flip: true },
  { x: 398, y: 138, s: 0.65, flip: false },
];

export const STONES: MeadowDecor[] = [
  { x: 868, y: 144, s: 1, flip: false },
  { x: 505, y: 146, s: 0.75, flip: true },
  { x: 122, y: 194, s: 0.9, flip: false },
  { x: 700, y: 150, s: 0.55, flip: false },
  { x: 232, y: 186, s: 0.65, flip: true },
];

export const PETAL_ANGLES = [0, 72, 144, 216, 288];
