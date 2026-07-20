/**
 * FNV-1a — THE app's deterministic hash (the Math.random ban's workhorse):
 * same input, same output, every device, every reload. Lived in
 * features/forest/tree-layout until 0.0.115; moved to core so core services
 * stop importing feature code (tree-layout re-exports it for the flora).
 */
export function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
