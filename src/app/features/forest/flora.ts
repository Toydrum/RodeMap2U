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
