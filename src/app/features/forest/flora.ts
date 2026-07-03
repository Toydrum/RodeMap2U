import { AccentToken } from '../../core/db/schema';

/**
 * Every tree is its own species: the accent chosen at planting defines the
 * shape and color of its blooms — in the tree, in the forest miniatures and
 * on the meadow. Deterministic, botanical, and a little bit magical.
 */

export type FlowerShape = 'petal5' | 'daisy' | 'bell' | 'star';

export interface FlowerSpec {
  shape: FlowerShape;
  petal: string;
  petalEdge: string;
  heart: string;
}

const FLORA: Record<AccentToken, FlowerSpec> = {
  moss: { shape: 'daisy', petal: '#f6f2e2', petalEdge: '#e4dcc0', heart: '#d9a441' },
  sage: { shape: 'bell', petal: '#f0d98c', petalEdge: '#d9bc62', heart: '#a8935a' },
  sky: { shape: 'petal5', petal: '#a7bfe3', petalEdge: '#7f9ccb', heart: '#f0d98c' },
  clay: { shape: 'star', petal: '#e8a06b', petalEdge: '#cf8350', heart: '#8c5a33' },
  lavender: { shape: 'daisy', petal: '#c8b4e8', petalEdge: '#a98fd6', heart: '#f0d98c' },
  sand: { shape: 'petal5', petal: '#f0cf74', petalEdge: '#d9b355', heart: '#a8935a' },
  rose: { shape: 'petal5', petal: '#e5a8c0', petalEdge: '#cf87a6', heart: '#a8935a' },
  pine: { shape: 'star', petal: '#c96a9e', petalEdge: '#a94d81', heart: '#f0d98c' },
};

export function flowerFor(accent: AccentToken): FlowerSpec {
  return FLORA[accent] ?? FLORA.rose;
}
