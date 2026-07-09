import { LEVEL_H, LayoutPoint } from './tree-layout';

/**
 * Pure label field: every branch name, always visible, never overlapping.
 *
 * Replaces the old shelf system, whose three failure modes the owner rejected:
 * labels popped in/out with zoom (k>=0.55 gate), hid entirely when a band
 * saturated, and truncated to 20/9 chars. Here every eligible node gets a
 * multi-line wrapped block packed into ONE global occupancy field. Nothing in
 * this module reads the zoom — labels are world-space and simply scale with
 * the tree, so visibility is identical at every k by construction.
 *
 * Physics honesty (agreed with the owner): 80-char titles in a 9-sibling fan
 * are geometrically impossible to show whole. Typical titles (≤25 chars) fit
 * fully even in dense fans; only very long titles inside saturated fans get
 * `clipped: true`, which the renderer paints as a soft gradient fade on the
 * tail — never an ellipsis, never a hidden name. The full title always lives
 * in the focused cartouche, the tablita, the node sheet and the aria-label.
 *
 * Deterministic throughout: same layout in → byte-identical field out.
 */

/** Average glyph advance at the 12.5px/800 face — the same arithmetic-only
 *  width convention the old shelves used (no DOM measurement, ever). */
export const CHAR_W = 8.1;
export const LINE_H = 13.5;
/** Base wrap width budget (world px) for a tier-1 line. */
const LINE_BUDGET = 118;
/** Horizontal breathing room reserved around every block. */
const MARGIN = 16;
/** Vertical lane quantum of the occupancy field. */
const LANE_H = 12;
/** First line's baseline offset below the node's row line (matches the old
 *  shelf-0 baseline so the tree's look stays familiar). */
export const LABEL_BASELINE = 27;
/** A block may not extend below this offset — the next row's glyphs start
 *  living there (focus ring r=24 + breathing room). */
const MAX_DEPTH_BELOW_ROW = 74;
/** Reserved for the "faroles" rest-boost experiment (--label-zoom CSS var):
 *  block envelopes would reserve BOOST× space so a partial zoom compensation
 *  never causes overlap. Shipped OFF (1.0) — flip only with a re-derivation
 *  of MAX_DEPTH_BELOW_ROW. */
export const BOOST = 1.0;

/** Crowding tiers — a whole neighborhood shares one, so smaller text reads as
 *  intentional typography, never as one name being punished. */
const TIERS = [1, 0.88, 0.76] as const;
const FLOOR_TIER = 0.76;

export interface LabelBlock {
  id: string;
  /** Wrapped lines, longest-first estimation already applied. When clipped,
   *  the LAST line has its final characters moved into `tail`. */
  lines: string[];
  /** Ghosted continuation characters of a clipped title (renderer fades
   *  them) — empty when the whole title fit. */
  tail: string;
  /** World x of the block's center (node x + packer-chosen dx). */
  cx: number;
  /** World y of the FIRST line's baseline. */
  y0: number;
  /** Font factor (tier × per-node emphasis) — multiply 12.5px by this. */
  factor: number;
  /** True when even the floor tier couldn't fit the whole title — the
   *  renderer fades the tail of the last line instead of cutting. */
  clipped: boolean;
  /** Estimated block width in world px (for tests / debugging). */
  width: number;
}

/** Move the last few characters of a clipped block's final line into `tail`
 *  so the renderer can ghost them (a soft "continues" cue, never an "…"). */
function withFadeTail(block: LabelBlock): LabelBlock {
  if (!block.clipped || !block.lines.length) return block;
  const last = block.lines[block.lines.length - 1];
  const cut = Math.min(4, Math.max(1, last.length - 1));
  return {
    ...block,
    lines: [...block.lines.slice(0, -1), last.slice(0, last.length - cut)],
    tail: last.slice(last.length - cut),
  };
}

export interface LabelInput {
  id: string;
  title: string;
  x: number;
  /** Visual row line (pre-jitter, lift included) — rowY of the LayoutPoint. */
  rowY: number;
  /** Per-node emphasis multiplier (priority hook — 1 when absent). */
  emphasis: number;
  /** Extra width reserved left of line 1 (e.g. a small glyph). */
  leadGlyphW: number;
  /** Packs first and may never be clipped (the 📍 place). */
  pinned: boolean;
}

/** Greedy word wrap. A single word longer than the line hard-breaks with a
 *  hyphen (no word is ever silently dropped). */
export function wrapTitle(
  title: string,
  maxChars: number,
  maxLines: number,
): { lines: string[]; clipped: boolean } {
  const words = title.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  let clipped = false;
  const push = (): void => {
    if (line) lines.push(line);
    line = '';
  };
  for (let w = 0; w < words.length; w++) {
    let word = words[w];
    while (word.length > maxChars) {
      // Oversized single word: hard-break with a hyphen.
      push();
      if (lines.length >= maxLines) {
        clipped = true;
        break;
      }
      lines.push(word.slice(0, maxChars - 1) + '-');
      word = word.slice(maxChars - 1);
    }
    if (lines.length >= maxLines) {
      clipped = true;
      break;
    }
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= maxChars) {
      line = candidate;
      continue;
    }
    push();
    if (lines.length >= maxLines) {
      clipped = true;
      break;
    }
    line = word;
  }
  if (!clipped && line) {
    if (lines.length >= maxLines) clipped = true;
    else lines.push(line);
  }
  if (!lines.length) lines.push(title.slice(0, maxChars));
  return { lines: lines.slice(0, maxLines), clipped };
}

/** Local-crowding tier: how many labeled neighbors share this node's visual
 *  neighborhood. Layout-only, zoom-free — a fan reads as one type size. */
export function labelTier(point: LabelInput, all: LabelInput[]): number {
  let near = 0;
  for (const other of all) {
    if (other.id === point.id) continue;
    if (Math.abs(other.x - point.x) <= 150 && Math.abs(other.rowY - point.rowY) <= 36) near++;
  }
  if (near <= 4) return TIERS[0];
  if (near <= 7) return TIERS[1];
  return TIERS[2];
}

/** Regional smoothing: everyone adopts the smallest tier in their own
 *  neighborhood, so a crowded fan reads as ONE deliberate type size instead
 *  of one name looking singled out among bigger siblings. */
export function smoothedTiers(all: LabelInput[]): Map<string, number> {
  const raw = new Map<string, number>();
  for (const p of all) raw.set(p.id, labelTier(p, all));
  const out = new Map<string, number>();
  for (const p of all) {
    let tier = raw.get(p.id) ?? TIERS[0];
    for (const other of all) {
      if (other.id === p.id) continue;
      if (Math.abs(other.x - p.x) <= 150 && Math.abs(other.rowY - p.rowY) <= 36) {
        tier = Math.min(tier, raw.get(other.id) ?? TIERS[0]);
      }
    }
    out.set(p.id, tier);
  }
  return out;
}

interface Lane {
  /** Sorted, disjoint occupied x-intervals. */
  spans: { x0: number; x1: number }[];
}

function laneFree(lane: Lane, x0: number, x1: number): boolean {
  for (const s of lane.spans) {
    if (x0 < s.x1 && x1 > s.x0) return false;
  }
  return true;
}

function laneMark(lane: Lane, x0: number, x1: number): void {
  lane.spans.push({ x0, x1 });
}

function blockOf(
  input: LabelInput,
  factor: number,
  maxLines: number,
  maxCharsOverride?: number,
): { lines: string[]; clipped: boolean; w: number; h: number } {
  const maxChars =
    maxCharsOverride ?? Math.max(6, Math.floor(LINE_BUDGET / (CHAR_W * factor)));
  const { lines, clipped } = wrapTitle(input.title, maxChars, maxLines);
  const longest = lines.reduce((m, l) => Math.max(m, l.length), 0);
  const w = longest * CHAR_W * factor * BOOST + 14 + input.leadGlyphW;
  const h = lines.length * LINE_H * factor * BOOST;
  return { lines, clipped, w, h };
}

/**
 * Pack every label into one global field. Deterministic placement order:
 * pinned (📍) first, then rowY descending (trunk-near names get stable
 * spots), then x ascending. Placement never exceeds ±28px horizontal drift,
 * so a label stays visually attached to its branch.
 */
export function packLabels(inputs: LabelInput[]): Map<string, LabelBlock> {
  const out = new Map<string, LabelBlock>();
  const lanes = new Map<number, Lane>();

  const free = (x0: number, y0: number, w: number, h: number): boolean => {
    const l0 = Math.floor(y0 / LANE_H);
    const l1 = Math.floor((y0 + h - 0.01) / LANE_H);
    for (let l = l0; l <= l1; l++) {
      const lane = lanes.get(l);
      if (lane && !laneFree(lane, x0, x0 + w)) return false;
    }
    return true;
  };
  const mark = (x0: number, y0: number, w: number, h: number): void => {
    const l0 = Math.floor(y0 / LANE_H);
    const l1 = Math.floor((y0 + h - 0.01) / LANE_H);
    for (let l = l0; l <= l1; l++) {
      let lane = lanes.get(l);
      if (!lane) {
        lane = { spans: [] };
        lanes.set(l, lane);
      }
      laneMark(lane, x0, x0 + w);
    }
  };

  const ordered = [...inputs].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (a.rowY !== b.rowY) return b.rowY - a.rowY;
    return a.x - b.x;
  });

  const DYS = [0, 13, 26, 39];
  // Preferred drift keeps a label visually attached (±28); the wider tail
  // exists for the shrink-ladder rungs in saturated fans. Precondition
  // (guaranteed by layoutTree's disjoint slot spans): same-row nodes sit
  // ≥ ~48px apart — the packer cannot conjure space for stacked anchors.
  const DXS = [0, 14, -14, 28, -28, 42, -42, 56, -56, 70, -70, 84, -84];
  const tiers = smoothedTiers(inputs);

  for (const input of ordered) {
    const tier = tiers.get(input.id) ?? TIERS[0];
    // Whole-title placements first (own tier, then the floor tier — smaller
    // and whole beats big and cut). If neither fits, a GRID-CHECKED shrink
    // ladder of clipped blocks: every rung still refuses to overlap, so
    // "never overlap" stays a hard invariant all the way down.
    const floor = FLOOR_TIER * input.emphasis;
    const attempts: {
      factor: number;
      maxLines: number;
      acceptClipped: boolean;
      maxChars?: number;
    }[] = [
      { factor: tier * input.emphasis, maxLines: tier === 1 ? 3 : 4, acceptClipped: false },
    ];
    if (tier !== FLOOR_TIER) {
      attempts.push({ factor: floor, maxLines: 4, acceptClipped: false });
    }
    attempts.push(
      { factor: floor, maxLines: 2, acceptClipped: true },
      { factor: floor, maxLines: 1, acceptClipped: true },
      { factor: floor, maxLines: 1, acceptClipped: true, maxChars: 12 },
      { factor: floor, maxLines: 1, acceptClipped: true, maxChars: 8 },
      { factor: floor, maxLines: 1, acceptClipped: true, maxChars: 5 },
    );

    let placedBlock: LabelBlock | null = null;
    for (const attempt of attempts) {
      const { lines, clipped, w, h } = blockOf(
        input,
        attempt.factor,
        attempt.maxLines,
        attempt.maxChars,
      );
      if (clipped && !attempt.acceptClipped) continue;
      for (const dy of DYS) {
        const yTop = input.rowY + LABEL_BASELINE + dy - LINE_H * attempt.factor;
        if (yTop + h > input.rowY + MAX_DEPTH_BELOW_ROW) break;
        for (const dx of DXS) {
          const cx = input.x + dx;
          const x0 = cx - w / 2 - MARGIN;
          if (!free(x0, yTop, w + MARGIN * 2, h)) continue;
          mark(x0, yTop, w + MARGIN * 2, h);
          placedBlock = {
            id: input.id,
            lines,
            tail: '',
            cx,
            y0: input.rowY + LABEL_BASELINE + dy,
            factor: attempt.factor,
            clipped,
            width: w,
          };
          break;
        }
        if (placedBlock) break;
      }
      if (placedBlock) break;
    }

    if (!placedBlock) {
      // Physics floor: exhaustive sweep with the tiniest block (5 chars +
      // fade). Still grid-checked — overlap stays impossible; the label just
      // drifts further from its branch than the preferred ±28.
      const factor = FLOOR_TIER * input.emphasis;
      const { lines, w, h } = blockOf(input, factor, 1, 5);
      sweep: for (const dy of DYS) {
        const yTop = input.rowY + LABEL_BASELINE + dy - LINE_H * factor;
        if (yTop + h > input.rowY + MAX_DEPTH_BELOW_ROW) break;
        for (let step = 0; step <= 24; step++) {
          const dx = (step % 2 ? -1 : 1) * Math.ceil(step / 2) * 12;
          const cx = input.x + dx;
          if (!free(cx - w / 2 - MARGIN, yTop, w + MARGIN * 2, h)) continue;
          mark(cx - w / 2 - MARGIN, yTop, w + MARGIN * 2, h);
          placedBlock = {
            id: input.id,
            lines,
            tail: '',
            cx,
            y0: input.rowY + LABEL_BASELINE + dy,
            factor,
            clipped: true,
            width: w,
          };
          break sweep;
        }
      }
    }
    if (!placedBlock) {
      // Truly zero free cells anywhere near the node (pathological input
      // outside layoutTree's disjoint-span guarantee): a dot-sized marker at
      // the anchor. Reserved anyway so nothing ELSE lands on it.
      const factor = FLOOR_TIER * input.emphasis;
      const { lines, w, h } = blockOf(input, factor, 1, 5);
      const yTop = input.rowY + LABEL_BASELINE - LINE_H * factor;
      mark(input.x - w / 2 - MARGIN, yTop, w + MARGIN * 2, h);
      placedBlock = {
        id: input.id,
        lines,
        tail: '',
        cx: input.x,
        y0: input.rowY + LABEL_BASELINE,
        factor,
        clipped: true,
        width: w,
      };
    }
    out.set(input.id, withFadeTail(placedBlock));
  }
  return out;
}

/** Convenience used by the canvas: LayoutPoint[] → LabelInput[] with the
 *  chain doctrine applied (chain links label only via `labeledChainIds`). */
export function labelInputsFrom(
  points: LayoutPoint[],
  opts: {
    currentNodeId: string | null;
    labeledChainIds: ReadonlySet<string>;
    emphasisOf: (p: LayoutPoint) => number;
    leadGlyphOf: (p: LayoutPoint) => number;
  },
): LabelInput[] {
  const out: LabelInput[] = [];
  for (const p of points) {
    // Chain doctrine: links stay quiet except the NEXT open step — but the
    // 📍 place always speaks its name, chain link or not.
    const isPinned = opts.currentNodeId === p.node.id;
    if (p.chain && !opts.labeledChainIds.has(p.node.id) && !isPinned) continue;
    out.push({
      id: p.node.id,
      title: p.node.title,
      x: p.x,
      rowY: p.rowY ?? -p.depth * LEVEL_H,
      emphasis: opts.emphasisOf(p),
      leadGlyphW: opts.leadGlyphOf(p),
      pinned: isPinned,
    });
  }
  return out;
}
