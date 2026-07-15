import { AccentToken } from '../../core/db/schema';
import { hash } from './tree-layout';

/**
 * Every tree is its own species: the accent chosen at planting defines the
 * COLOR FAMILY of its blooms, and each tree picks one of three cousin
 * SILHOUETTES within that family (hash of the tree id) — same accent still
 * reads as the same species at a glance (hue dominates recognition), but
 * same-accent trees may bloom differently. Used in the tree, the forest
 * miniatures and on the meadow. Deterministic, botanical, a little magical.
 * (0.0.64 grew the garden to sixteen shapes from the owner's reference
 * sheet; the % pick means existing trees re-chose their cousin once.)
 */

export type FlowerShape =
  | 'petal5'
  | 'daisy'
  | 'bell'
  | 'star'
  | 'poppy'
  | 'lupine'
  | 'anemone'
  | 'trumpet'
  | 'sunflower'
  | 'clover'
  | 'tulip'
  | 'carnation'
  | 'pinwheel'
  | 'jasmine'
  | 'spray'
  | 'dahlia';

export interface FlowerSpec {
  shape: FlowerShape;
  petal: string;
  petalEdge: string;
  heart: string;
}

/** Three cousins per accent — the classic first (kept for continuity), two
 *  newer silhouettes after, same palette family. */
const FLORA: Record<AccentToken, FlowerSpec[]> = {
  moss: [
    { shape: 'daisy', petal: '#f6f2e2', petalEdge: '#e4dcc0', heart: '#d9a441' },
    { shape: 'anemone', petal: '#f2ecd6', petalEdge: '#ddd2ac', heart: '#5c5136' },
    { shape: 'clover', petal: '#eef0da', petalEdge: '#d6d8b2', heart: '#c9973d' },
  ],
  sage: [
    { shape: 'bell', petal: '#f0d98c', petalEdge: '#d9bc62', heart: '#a8935a' },
    { shape: 'lupine', petal: '#e8cd7e', petalEdge: '#cbab52', heart: '#8f7c48' },
    { shape: 'spray', petal: '#e5c973', petalEdge: '#c4a34e', heart: '#8f7c48' },
  ],
  sky: [
    { shape: 'petal5', petal: '#a7bfe3', petalEdge: '#7f9ccb', heart: '#f0d98c' },
    { shape: 'trumpet', petal: '#9db8e0', petalEdge: '#7690c4', heart: '#f6e7ae' },
    { shape: 'jasmine', petal: '#b0c6e8', petalEdge: '#8aa5d2', heart: '#f0d98c' },
  ],
  clay: [
    { shape: 'star', petal: '#e8a06b', petalEdge: '#cf8350', heart: '#8c5a33' },
    { shape: 'poppy', petal: '#e59459', petalEdge: '#c67641', heart: '#5e3a1e' },
    { shape: 'sunflower', petal: '#eda964', petalEdge: '#d28844', heart: '#7a4a26' },
  ],
  lavender: [
    { shape: 'daisy', petal: '#c8b4e8', petalEdge: '#a98fd6', heart: '#f0d98c' },
    { shape: 'anemone', petal: '#bfa9e3', petalEdge: '#9c81cf', heart: '#4d3f6b' },
    { shape: 'tulip', petal: '#c3ade6', petalEdge: '#a288d2', heart: '#5c4a80' },
  ],
  sand: [
    { shape: 'petal5', petal: '#f0cf74', petalEdge: '#d9b355', heart: '#a8935a' },
    { shape: 'lupine', petal: '#ecc766', petalEdge: '#d0a844', heart: '#8f7c48' },
    { shape: 'dahlia', petal: '#eeca6d', petalEdge: '#d4ae4c', heart: '#a8935a' },
  ],
  rose: [
    { shape: 'petal5', petal: '#e5a8c0', petalEdge: '#cf87a6', heart: '#a8935a' },
    { shape: 'poppy', petal: '#e099b6', petalEdge: '#c7789b', heart: '#6b3a50' },
    { shape: 'carnation', petal: '#e8a0bd', petalEdge: '#d07fa2', heart: '#7d4360' },
  ],
  pine: [
    { shape: 'star', petal: '#c96a9e', petalEdge: '#a94d81', heart: '#f0d98c' },
    { shape: 'anemone', petal: '#c05f95', petalEdge: '#9e4377', heart: '#f2e3ac' },
    { shape: 'pinwheel', petal: '#cc6ba0', petalEdge: '#ad5084', heart: '#f0d98c' },
  ],
};

/** Accent → family; the seed id (usually the TREE id, so a whole tree blooms
 *  one way) → the cousin. Omit `seedId` for the classic. */
export function flowerFor(accent: AccentToken, seedId?: string): FlowerSpec {
  // Fallback matches tree-forms' (moss): a drifted accent must not bloom
  // rose flowers on a moss-dialed body.
  const variants = FLORA[accent] ?? FLORA.moss;
  if (!seedId) return variants[0];
  return variants[hash(seedId + ':flora') % variants.length];
}

/**
 * «La cosecha» (0.0.88): every species also bears its FRUIT. Same law as
 * FLORA — the accent fixes the KIND (a manzano always drops manzanas; hue +
 * silhouette carry recognition), the seed id picks one of three cousins
 * that vary only ripeness/tint. Fruit palettes anchor to the FLOWER family
 * hexes (not the --accent-* tokens — pine's accent is teal but its blooms
 * are magenta, and the fruit sits next to the bloom). NEVER shown as a
 * catalog or taxonomy: a fruit is labeled by its branch's words only.
 */
export type FruitShape =
  | 'manzana'
  | 'pera'
  | 'arandanos'
  | 'naranja'
  | 'uvas'
  | 'durazno'
  | 'cerezas'
  | 'moras';

export interface FruitSpec {
  shape: FruitShape;
  /** Body fill. */
  skin: string;
  /** Outline — same stroke DNA as petal/petalEdge. */
  skinEdge: string;
  /** Cheek / dusty bloom / shoulder-light accent, used at low opacity. */
  blush: string;
}

const FRUTAS: Record<AccentToken, FruitSpec[]> = {
  moss: [
    { shape: 'manzana', skin: '#c9d18e', skinEdge: '#96a35c', blush: '#dfae6b' },
    { shape: 'manzana', skin: '#e3c878', skinEdge: '#b59b4a', blush: '#d9a441' },
    { shape: 'manzana', skin: '#d4cc8a', skinEdge: '#a8a05a', blush: '#d98f6b' },
  ],
  sage: [
    { shape: 'pera', skin: '#e8d381', skinEdge: '#c2a94f', blush: '#f4e6a8' },
    { shape: 'pera', skin: '#d9d488', skinEdge: '#aeb055', blush: '#eef0c0' },
    { shape: 'pera', skin: '#e5c973', skinEdge: '#b89740', blush: '#f2e0a0' },
  ],
  sky: [
    { shape: 'arandanos', skin: '#7f9ccb', skinEdge: '#5c77a8', blush: '#cfdcf2' },
    { shape: 'arandanos', skin: '#8aa5d2', skinEdge: '#6681b0', blush: '#d8e3f5' },
    { shape: 'arandanos', skin: '#7690c4', skinEdge: '#54709e', blush: '#c6d5ee' },
  ],
  clay: [
    { shape: 'naranja', skin: '#e8964f', skinEdge: '#c26f35', blush: '#f4c290' },
    { shape: 'naranja', skin: '#eda964', skinEdge: '#d28844', blush: '#f6d0a2' },
    { shape: 'naranja', skin: '#dd8348', skinEdge: '#b05e2c', blush: '#efb385' },
  ],
  lavender: [
    { shape: 'uvas', skin: '#a98fd6', skinEdge: '#7f63b0', blush: '#d9cbf0' },
    { shape: 'uvas', skin: '#9c81cf', skinEdge: '#7257a6', blush: '#d0c0ec' },
    { shape: 'uvas', skin: '#b49ade', skinEdge: '#8a6fbc', blush: '#e2d6f4' },
  ],
  sand: [
    { shape: 'durazno', skin: '#f0b26a', skinEdge: '#cf8b3f', blush: '#e08a94' },
    { shape: 'durazno', skin: '#ecc06f', skinEdge: '#cb9a45', blush: '#d97a86' },
    { shape: 'durazno', skin: '#eeaa5f', skinEdge: '#c98436', blush: '#e494a0' },
  ],
  rose: [
    { shape: 'cerezas', skin: '#d16487', skinEdge: '#a84463', blush: '#f0b8ca' },
    { shape: 'cerezas', skin: '#c7789b', skinEdge: '#9e5378', blush: '#eac3d2' },
    { shape: 'cerezas', skin: '#dd7194', skinEdge: '#b24e6f', blush: '#f4c4d4' },
  ],
  pine: [
    { shape: 'moras', skin: '#a94d81', skinEdge: '#7e3560', blush: '#d497bb' },
    { shape: 'moras', skin: '#9e4377', skinEdge: '#742f57', blush: '#cd8db2' },
    { shape: 'moras', skin: '#b3588c', skinEdge: '#88406a', blush: '#dba2c4' },
  ],
};

/** Salt ':fruta' — distinct from ':flora', so a tree's fruit cousin never
 *  correlates with its flower cousin. Fallback = moss (flowerFor's law). */
export function fruitFor(accent: AccentToken, seedId?: string): FruitSpec {
  const variants = FRUTAS[accent] ?? FRUTAS.moss;
  if (!seedId) return variants[0];
  return variants[hash(seedId + ':fruta') % variants.length];
}

/** «La conservería» (0.0.89): the jam tint — the numeric average of the
 *  member species' classic skins (deterministic, order-free; CSS color-mix
 *  only blends two). One species → its own skin; the forest jam gets the
 *  true blend of everything in the pot. */
export function jamTint(accents: AccentToken[]): { tint: string; tintEdge: string } {
  const distinct = [...new Set(accents)];
  const specs = distinct.map((a) => (FRUTAS[a] ?? FRUTAS.moss)[0]);
  return { tint: blendHex(specs.map((s) => s.skin)), tintEdge: blendHex(specs.map((s) => s.skinEdge)) };
}

function blendHex(hexes: string[]): string {
  if (hexes.length === 1) return hexes[0];
  let r = 0;
  let g = 0;
  let b = 0;
  for (const hex of hexes) {
    r += parseInt(hex.slice(1, 3), 16);
    g += parseInt(hex.slice(3, 5), 16);
    b += parseInt(hex.slice(5, 7), 16);
  }
  const n = hexes.length;
  const to2 = (v: number) => Math.round(v / n).toString(16).padStart(2, '0');
  return `#${to2(r)}${to2(g)}${to2(b)}`;
}
