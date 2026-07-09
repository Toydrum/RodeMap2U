import {
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Tree, TreeNode } from '../../core/db/schema';
import { NodesRepo } from '../../core/repos/nodes.repo';
import { I18nService } from '../../core/i18n/i18n.service';
import { MotionService } from '../../core/motion.service';
import {
  EdgeGeometry,
  LEVEL_H,
  LayoutPoint,
  branchRibbon,
  edgeGeometry,
  edgePointAt,
  hash,
  layoutTree,
  ribbonWidthAt,
  taperedRibbon,
  widthForMass,
} from './tree-layout';
import { FlowerSpec, flowerFor } from './flora';
import { TreeForm, formFor } from './tree-forms';
import { FlowerGlyph } from './flower';
import { CHAR_W, LABEL_BASELINE, LabelBlock, labelInputsFrom, packLabels, wrapTitle } from './tree-labels';

interface LeafDecoration {
  x: number;
  y: number;
  angle: number;
  size: number;
  kind: 'leaf' | 'blossom';
  /** Shape family (almond / willow / round / asymmetric). */
  variant: number;
  /** Green shade (base / deep / warm) — overlap reads as real foliage. */
  shade: number;
}

interface PadDecoration {
  x: number;
  y: number;
  rx: number;
  ry: number;
  rot: number;
  shade: number;
}

interface EdgeView {
  id: string;
  d: string;
  fill: string;
  isNew: boolean;
  leaves: LeafDecoration[];
  /** Foliage pads clustering at the tip — the crown's soft volume. */
  pads: PadDecoration[];
  /** Bark grain: the limb's center line, stroked dashed and faint. */
  grain: string;
  grainWidth: number;
  grainOffset: number;
}

/** How one limb is drawn: where it starts (the parent point, or an anchor
 *  along the leader limb for side forks), its curve, and its wood widths. */
interface LimbPlan {
  start: { x: number; y: number };
  geom: EdgeGeometry;
  w0: number;
  w1: number;
  isLeaf: boolean;
}

/**
 * The living map: an SVG tree that actually looks like one — thick tapering
 * limbs, procedural leaves, flowers on achieved goals, ground under the roots.
 * Pointer pan/zoom (1 finger pan, 2 finger pinch, ctrl-wheel zoom), roving
 * tabindex keyboard navigation, a one-time "grow" animation for newborn
 * branches, and a floating "+" bud on the focused node to plant right there.
 */
@Component({
  selector: 'app-tree-canvas',
  imports: [FlowerGlyph],
  templateUrl: './tree-canvas.html',
  styleUrl: './tree-canvas.scss',
  // Closes the little note letter when tapping anywhere else (never preventDefault).
  host: { '(document:pointerdown)': 'onDocPointerDown($event)' },
})
export class TreeCanvas {
  readonly tree = input.required<Tree>();
  readonly nodeOpened = output<TreeNode>();
  readonly plantRequested = output<TreeNode>();

  protected readonly nodes = inject(NodesRepo);
  protected readonly i18n = inject(I18nService);
  protected readonly motion = inject(MotionService);
  protected readonly Math = Math;
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly svgRef = viewChild.required<ElementRef<SVGSVGElement>>('svg');

  /** Pan/zoom state. */
  protected readonly tx = signal(0);
  protected readonly ty = signal(0);
  protected readonly k = signal(1);

  /** Paper leaf under the pointer — a little letter opens beside it. */
  protected readonly hoverNote = signal<{ node: TreeNode; wx: number; wy: number } | null>(null);

  /** The letter follows its mark through pan and zoom. */
  protected readonly letterPos = computed(() => {
    const hover = this.hoverNote();
    if (!hover) return null;
    return { x: this.tx() + hover.wx * this.k(), y: this.ty() + hover.wy * this.k() };
  });

  protected showLetter(point: LayoutPoint): void {
    this.hoverNote.set({ node: point.node, wx: point.x + 18, wy: point.y - 24 });
  }

  protected hideLetter(): void {
    this.hoverNote.set(null);
  }

  /** Mouse hovers; touch taps to toggle (hover events fight the tap there). */
  protected onMarkEnter(ev: PointerEvent, point: LayoutPoint): void {
    if (ev.pointerType === 'mouse') this.showLetter(point);
  }

  protected onMarkLeave(ev: PointerEvent): void {
    if (ev.pointerType === 'mouse') this.hideLetter();
  }

  protected toggleLetter(point: LayoutPoint): void {
    if (this.hoverNote()?.node.id === point.node.id) {
      this.hideLetter();
    } else {
      this.showLetter(point);
    }
  }

  /** Tapping anywhere outside the mark/letter puts the letter away. */
  protected onDocPointerDown(ev: PointerEvent): void {
    if (!this.hoverNote()) return;
    if ((ev.target as Element).closest?.('.note-mark, .note-letter')) return;
    this.hideLetter();
  }

  /** Roving tabindex focus (also drives the "+" bud). Public: the outline
   *  rail highlights the focused row and calls focusNode() to locate. */
  readonly focusedId = signal<string | null>(null);

  /** Nodes created this session get the grow animation exactly once. */
  private readonly bornThisSession = new Set<string>();
  private knownIds: Set<string> | null = null;

  protected readonly layout = computed(() => {
    const tree = this.tree();
    const roots = this.nodes.rootsOf(tree.id);
    return layoutTree(roots, (n) => this.nodes.childrenOf(n));
  });

  /** This tree's flower species (shape + colors from its accent). */
  protected readonly species = computed<FlowerSpec>(() => flowerFor(this.tree().accent));

  /** This tree's silhouette personality — "cada árbol su porte". */
  protected readonly form = computed<TreeForm>(() => formFor(this.tree().accent));

  protected readonly roots = computed(() => this.layout().points.filter((p) => p.parent === null));

  /** Ground line sits a bit under the deepest root. */
  protected readonly groundY = computed(() => {
    const roots = this.roots();
    if (!roots.length) return 80;
    return Math.max(...roots.map((r) => r.y)) + 64;
  });

  /** World-space life around the base: grass clusters + a few flowers. */
  protected readonly groundDecor = computed(() => {
    const layout = this.layout();
    const tree = this.tree();
    if (!layout.points.length) return { grass: [], flowers: [] };
    const centerX = layout.minX + layout.width / 2;
    const spread = Math.max(240, layout.width * 0.9);
    const gy = this.groundY();

    const grass = Array.from({ length: 7 }, (_, i) => {
      const h = hash(tree.id + ':g' + i);
      return {
        x: centerX - spread + ((h % 1000) / 1000) * spread * 2,
        y: gy - 8 + ((h >> 8) % 14),
        flip: h % 2 === 0,
      };
    });

    const flowers = Array.from({ length: 3 }, (_, i) => {
      const h = hash(tree.id + ':f' + i);
      return {
        x: centerX - spread * 0.9 + ((h % 1000) / 1000) * spread * 1.8,
        y: gy - 4 + ((h >> 6) % 10),
        scale: 0.32 + ((h >> 4) % 14) / 100,
        sway: -10 + (h % 21),
      };
    });

    return { grass, flowers };
  });

  /** The silhouette brain: how every limb is drawn. Per parent, the child
   *  carrying the most leaf-mass is the LEADER — its edge continues the
   *  trunk line (calm bow, opposite hand, full width); the other children
   *  fork off the leader limb at staggered heights (their wood starts at an
   *  anchor along it, node positions untouched). Chains keep their classic
   *  vertical treatment — they already ARE a continuation. */
  private readonly limbPlan = computed<Map<string, LimbPlan>>(() => {
    const plan = new Map<string, LimbPlan>();
    const wood = this.wood();
    const f = this.form();
    const girth = wood.girth * f.girthMul;
    const width = (p: LayoutPoint) => widthForMass(p.mass ?? 1, girth);
    const tip = (p: LayoutPoint) => this.nodes.childrenOf(p.node).length === 0 && !p.chainNextId;

    const byParent = new Map<string, LayoutPoint[]>();
    for (const p of this.layout().points) {
      if (!p.parent) continue;
      const list = byParent.get(p.parent.node.id) ?? [];
      list.push(p);
      byParent.set(p.parent.node.id, list);
    }

    for (const children of byParent.values()) {
      const parent = children[0].parent!;
      const normal = children.filter((c) => !c.chain);

      // Chain links: exactly the classic path — vertical, no leader math.
      for (const c of children.filter((x) => x.chain)) {
        const geom = edgeGeometry(parent, c, wood.bow);
        plan.set(c.node.id, {
          start: parent,
          geom,
          w0: width(parent) * 0.9,
          w1: Math.max(2.4, width(c) * (tip(c) ? 0.45 : 0.95)),
          isLeaf: tip(c),
        });
      }
      if (!normal.length) continue;

      let leader = normal[0];
      for (const c of normal) if ((c.mass ?? 1) > (leader.mass ?? 1)) leader = c;

      const parentHand: 1 | -1 = hash(parent.node.id) % 2 === 0 ? 1 : -1;
      const leaderGeom = edgeGeometry(parent, leader, wood.bow, {
        upBias: Math.min(0.95, f.upBias + 0.5 * f.leaderBias),
        bowMul: f.bowMul * (1 - f.leaderBias),
        hand: (parentHand * -1) as 1 | -1,
      });
      const leaderW0 = width(parent) * 0.98;
      const leaderW1 = Math.max(2.4, width(leader) * (tip(leader) ? 0.45 : 1));
      plan.set(leader.node.id, {
        start: parent,
        geom: leaderGeom,
        w0: leaderW0,
        w1: leaderW1,
        isLeaf: tip(leader),
      });

      // Real-tree fork order: the FARTHEST-reaching side limb leaves LOWEST
      // (it needs the longest run), short twigs fork higher up — sorted by
      // horizontal reach so ribbons never cross into parallel-rail tangles.
      const sides = normal
        .filter((c) => c !== leader)
        .sort((a, b) => Math.abs(b.x - parent.x) - Math.abs(a.x - parent.x));
      // Crowded forks spread over a wider window and slim their collars so
      // the crotch never welds into one wooden blob.
      const tMax = sides.length >= 4 ? Math.min(0.92, f.forkTMax + 0.12) : f.forkTMax;
      const span = tMax - f.forkTMin;
      const collarMul = sides.length >= 4 ? 0.78 : 0.9;
      sides.forEach((c, i) => {
        const h = hash(c.node.id + ':fork');
        const t = f.forkTMin + span * ((i + 0.35 + (h % 31) / 120) / Math.max(1, sides.length));
        const start = edgePointAt(parent, leader, leaderGeom, t);
        const geom = edgeGeometry(start, c, wood.bow, {
          upBias: Math.max(0.1, Math.min(0.9, f.upBias + ((h >> 5) % 21) / 100 - 0.1)),
          bowMul: f.bowMul,
        });
        // A limb may flare at its collar but never outgrow the wood it forks from.
        const collar = collarMul * ribbonWidthAt(leaderW0, leaderW1, t);
        plan.set(c.node.id, {
          start,
          geom,
          w0: Math.min(width(c) * 1.25, Math.max(2.6, collar)),
          w1: Math.max(2.4, width(c) * (tip(c) ? 0.45 : 0.9)),
          isLeaf: tip(c),
        });
      });
    }
    return plan;
  });

  protected readonly edges = computed<EdgeView[]>(() =>
    this.layout()
      .points.filter((p) => p.parent !== null)
      .map((p) => {
        const plan = this.limbPlan().get(p.node.id)!;
        return {
          id: p.node.id,
          d: branchRibbon(plan.start, p, plan.geom, plan.w0, plan.w1),
          fill: this.woodFill(p),
          isNew: this.bornThisSession.has(p.node.id),
          leaves: this.leavesFor(p, plan.start, plan.geom, plan.isLeaf),
          pads: this.padsFor(p, plan.start, plan.geom, plan.isLeaf),
          grain: plan.geom.d,
          grainWidth: Math.max(1.1, plan.w1 * 0.35),
          grainOffset: hash(p.node.id + ':grain') % 16,
        };
      }),
  );

  /** Each tree grows its own wood: sinuosity, girth and bark family. */
  protected readonly wood = computed(() => {
    const h = hash(this.tree().id + ':wood');
    return {
      bow: 0.85 + (h % 46) / 100,
      girth: 0.88 + ((h >> 5) % 28) / 100,
      barkBase: [
        'var(--rm-bark)',
        'color-mix(in srgb, var(--rm-bark) 68%, #4a3826)',
        'color-mix(in srgb, var(--rm-bark) 72%, #94815f)',
      ][h % 3],
    };
  });

  /** Bark near the trunk, greener toward the twigs; branch-children lean golden. */
  private woodFill(point: LayoutPoint): string {
    const jitter = (hash(point.node.id + ':barkjit') % 9) - 4;
    const barkPct = Math.min(94, Math.max(28, 92 - point.depth * 16 + jitter));
    const base = `color-mix(in srgb, ${this.wood().barkBase} ${barkPct}%, var(--rm-twig))`;
    return point.node.origin === 'branch'
      ? `color-mix(in srgb, ${base} 72%, var(--status-branched))`
      : base;
  }

  /** Trunk ribbon: ground → root, with a gentle sway. Its top matches the
   *  root's mass-width so trunk → leader limb reads as one column of wood. */
  protected trunkPath(root: LayoutPoint): string {
    const gy = this.groundY();
    const wood = this.wood();
    const rootW = widthForMass(root.mass ?? 1, wood.girth * this.form().girthMul);
    const sway = ((hash(root.node.id + ':trunk') % 21) - 10) * 0.6 * wood.bow;
    return taperedRibbon(
      root.x + sway,
      gy - 2,
      root.x + sway * 0.4,
      gy - (gy - root.y) * 0.4,
      root.x - sway * 0.3,
      root.y + (gy - root.y) * 0.35,
      root.x,
      root.y,
      Math.min(34, rootW * 1.4),
      rootW,
    );
  }

  /** Deterministic foliage: leaf slots scale with limb length, some sprout
   *  opposite twins (leaf pairs), and twig tips gather a tuft. */
  private leavesFor(
    point: LayoutPoint,
    start: { x: number; y: number },
    geometry: EdgeGeometry,
    isTip: boolean,
  ): LeafDecoration[] {
    const status = point.node.status;
    const f = this.form();
    const h = hash(point.node.id + ':leaves');
    const length = Math.hypot(point.x - start.x, point.y - start.y);
    // One leaf slot every ~10-14px of limb; resting stays deliberately sparse;
    // the form's density dial gives acacias their air between pads.
    const spacing = status === 'achieved' ? 10 : status === 'growing' ? 11 : status === 'resting' ? 30 : 14;
    const density = status === 'resting' ? 1 : f.leafDensityMul;
    const slots = Math.max(
      status === 'resting' ? 2 : 3,
      Math.min(14, Math.round((length / spacing) * density)),
    );
    const leaves: LeafDecoration[] = [];
    for (let i = 0; i < slots; i++) {
      const hi = hash(point.node.id + ':leaf:' + i);
      const t = Math.min(0.93, 0.16 + (i / slots) * 0.72 + ((hi % 10) / 100));
      const at = edgePointAt(start, point, geometry, t);
      const side = (i + (h % 2)) % 2 === 0 ? 1 : -1;
      leaves.push({
        x: at.x + side * (3 + (hi % 6)),
        y: at.y,
        angle: side * (26 + (hi % 55)),
        size: 5 + ((hi >> 4) % 4),
        kind: status === 'achieved' && i === 0 ? 'blossom' : 'leaf',
        variant: hi % 4,
        shade: (hi >> 5) % 3,
      });
      // Some slots sprout an opposite twin — pairs read as real foliage.
      if (hi % 5 < 2 && status !== 'resting') {
        leaves.push({
          x: at.x - side * (3 + ((hi >> 3) % 5)),
          y: at.y + 1,
          angle: -side * (30 + ((hi >> 5) % 45)),
          size: 4.5 + ((hi >> 7) % 3),
          kind: 'leaf',
          variant: (hi >> 8) % 4,
          shade: (hi >> 11) % 3,
        });
      }
    }
    return leaves;
  }

  /** Foliage PADS: soft clustered volumes at branch tips — how real crowns
   *  read from afar (the tuft, grown up). Resting stays winter-quiet;
   *  growing keeps its sapling glyph clear. */
  private padsFor(
    point: LayoutPoint,
    start: { x: number; y: number },
    geometry: EdgeGeometry,
    isTip: boolean,
  ): PadDecoration[] {
    const f = this.form();
    const status = point.node.status;
    if (!isTip || status === 'branched' || status === 'resting') return [];
    const h = hash(point.node.id + ':pads');
    const count = f.padCount[0] + (h % (f.padCount[1] - f.padCount[0] + 1));
    const tLo = status === 'growing' ? 0.6 : 0.82;
    const tHi = status === 'growing' ? 0.78 : 0.98;
    const pads: PadDecoration[] = [];
    for (let i = 0; i < count; i++) {
      const hi = hash(point.node.id + ':pad:' + i);
      const t = tLo + ((i + (hi % 30) / 100) / count) * (tHi - tLo);
      const at = edgePointAt(start, point, geometry, Math.min(0.99, t));
      const x = at.x + (((hi >> 3) % (f.padSpread * 2 + 1)) - f.padSpread);
      const y = at.y - ((hi >> 6) % Math.max(2, Math.round(f.padSpread * 0.8)));
      // The growing sapling glyph must stay visible through its crown.
      if (status === 'growing' && Math.hypot(x - point.x, y - point.y) < 18) continue;
      pads.push({
        x,
        y,
        rx: f.padRx[0] + ((hi >> 9) % (f.padRx[1] - f.padRx[0] + 1)),
        ry: f.padRy[0] + ((hi >> 12) % (f.padRy[1] - f.padRy[0] + 1)),
        rot: f.id === 'acacia' ? ((hi >> 15) % 13) - 6 : ((hi >> 15) % 41) - 20,
        shade: (hi >> 5) % 3,
      });
    }
    return pads;
  }

  private readonly pointers = new Map<number, { x: number; y: number }>();
  private pinchStart: { dist: number; k: number; midX: number; midY: number; tx: number; ty: number } | null = null;
  private panStart: { x: number; y: number; tx: number; ty: number } | null = null;
  private movedSinceDown = false;

  constructor() {
    // Track newborn nodes for the grow animation; pan the newest into view
    // so planting can never grow the tree off-screen unnoticed.
    effect(() => {
      const ids = new Set(this.layout().points.map((p) => p.node.id));
      if (this.knownIds) {
        let lastNew: LayoutPoint | null = null;
        for (const id of ids) {
          if (!this.knownIds.has(id)) {
            this.bornThisSession.add(id);
            lastNew = this.layout().byId.get(id) ?? null;
          }
        }
        if (lastNew) {
          const p = lastNew;
          queueMicrotask(() => this.panIntoView(p));
        }
      }
      this.knownIds = ids;
    });

    // Frame ONCE per tree (id-keyed): renames and status flips must never
    // yank the camera around — that was a real pre-0.0.39 annoyance.
    effect(() => {
      const id = this.tree().id;
      if (!this.layout().points.length || id === this.lastFitId) return;
      this.lastFitId = id;
      queueMicrotask(() => this.fitTree());
    });
  }

  private lastFitId: string | null = null;

  /* ------------------------------------------------------------------ */
  /* View helpers                                                        */
  /* ------------------------------------------------------------------ */

  protected transform(): string {
    return `translate(${this.tx()} ${this.ty()}) scale(${this.k()})`;
  }

  protected statusColor(node: TreeNode): string {
    return `var(--status-${node.status})`;
  }

  /** Cosmetic hover zone only — taps resolve via the canvas-level nearest
   *  pick, so this may never outgrow the slot spacing again (24 · 2 < 66). */
  protected hitRadius(): number {
    return Math.min(24, Math.max(16, 24 / this.k()));
  }

  /** The "+" bud keeps a finger-sized target even zoomed out. */
  protected budHitRadius(): number {
    return Math.max(14, Math.min(20, 16 / this.k()));
  }

  /** The bud floats above the node — except on an ordered-steps branch,
   *  where straight-up would land exactly on the first chain link (46px). */
  protected budTransform(point: LayoutPoint): string {
    const chainParent = point.node.flow === 'steps' && this.nodes.childrenOf(point.node).length > 0;
    return chainParent ? 'translate(32 -30)' : 'translate(0 -46)';
  }

  /** Per steps-branch: the earliest still-open step — it speaks its name. */
  private readonly nextStepIds = computed(() => {
    const out = new Set<string>();
    for (const p of this.layout().points) {
      if (p.node.flow !== 'steps') continue;
      const next = this.nodes
        .childrenOf(p.node)
        .find((c) => c.status === 'seed' || c.status === 'growing');
      if (next) out.add(next.id);
    }
    return out;
  });

  /** «La luz» drawn on the canvas — only live branches hold light; a stale
   *  value on an achieved/resting record stays visually inert. */
  protected lightOf(point: LayoutPoint): 'sunlit' | 'steady' | 'shade' {
    const status = point.node.status;
    if (status !== 'seed' && status !== 'growing') return 'steady';
    const p = point.node.priority;
    return p === 'sunlit' || p === 'shade' ? p : 'steady';
  }

  /** The label field: every branch name, wrapped and packed ONCE per layout
   *  change — never per zoom, never per focus. Visibility is therefore
   *  identical at every k by construction (tree-labels.ts owns the law). */
  private readonly labelField = computed(() => {
    const inputs = labelInputsFrom(this.layout().points, {
      currentNodeId: this.tree().currentNodeId,
      labeledChainIds: this.nextStepIds(),
      // «La luz»: sunlit titles read slightly larger (the owner's typographic
      // hierarchy, upward only). The packer reserves the width — emphasis can
      // never cause overlap — plus room for the rayito glyph.
      emphasisOf: (p) => (this.lightOf(p) === 'sunlit' ? 1.12 : 1),
      leadGlyphOf: (p) => (this.lightOf(p) === 'sunlit' ? 10 : 0),
    });
    return packLabels(inputs);
  });

  protected labelFor(point: LayoutPoint): LabelBlock | undefined {
    return this.labelField().get(point.node.id);
  }

  /** Focused node's FULL name as an overlay cartouche painted on top —
   *  tabbing must never reflow the packed field. Covers silent chain links
   *  too (focus always speaks, like it always has). */
  protected readonly focusTag = computed(() => {
    const id = this.focusedId();
    if (!id) return null;
    const point = this.layout().byId.get(id);
    if (!point) return null;
    const factor = 1.15;
    const maxChars = Math.max(8, Math.floor(180 / (CHAR_W * factor)));
    const { lines } = wrapTitle(point.node.title, maxChars, 6);
    const row = point.rowY ?? -point.depth * LEVEL_H;
    return { point, lines, factor, yRel: row + LABEL_BASELINE - point.y };
  });

  /** The growing sapling leans along its limb's incoming direction —
   *  tempered toward the sky (phototropism), never lying flat. Reads the
   *  SAME geometry the limb is drawn with (leader/fork aware). */
  protected saplingAngle(point: LayoutPoint): number {
    if (!point.parent) return 0;
    const plan = this.limbPlan().get(point.node.id);
    if (!plan) return 0;
    const deg = (Math.atan2(point.y - plan.geom.c2y, point.x - plan.geom.c2x) * 180) / Math.PI + 90;
    const normalized = ((deg + 180) % 360) - 180;
    return Math.max(-70, Math.min(70, normalized * 0.8));
  }

  protected nodeLabel(point: LayoutPoint): string {
    const t = this.i18n.t();
    const children = this.nodes.childrenOf(point.node).length;
    let label = this.i18n.fill(t.a11y.nodeLabel, {
      title: point.node.title,
      status: t.status[point.node.status],
    });
    if (children) label += `, ${this.i18n.plural(children, t.a11y.withChildren)}`;
    const light = this.lightOf(point);
    if (light !== 'steady') label += `, ${t.a11y.light[light]}`;
    return label;
  }

  /** Frame the WHOLE tree; when even the 0.5 floor can't fit it, keep that
   *  zoom and center on the 📍 neighborhood instead (panning reaches the rest). */
  fitTree(): void {
    const layout = this.layout();
    if (!layout.points.length) return;
    const svg = this.svgRef().nativeElement;
    const rect = svg.getBoundingClientRect();
    if (!rect.width) return;

    // The tree STANDS on the scenery's meadow line — never floats.
    const groundScreen = rect.height * 0.8;
    const padX = 40;
    const worldW = layout.width + 120; // label + jitter margin
    const fitK = Math.min(
      (rect.width - padX * 2) / worldW,
      (groundScreen - 70) / (layout.height + 90),
    );
    // Young trees should still fill the view instead of drowning in it.
    const fillK = (rect.height * 0.42) / Math.max(layout.height + 60, 180);
    // Floor 0.5: same-row spacing stays ≥ ~39 screen px — comfortably tappable.
    const k = Math.min(1.6, Math.max(0.5, Math.min(fitK, Math.max(1.15, fillK))));

    this.fitsWhole = worldW * k <= rect.width - padX * 2;
    const currentId = this.tree().currentNodeId;
    const current = currentId ? layout.byId.get(currentId) : null;
    const cx = this.fitsWhole || !current ? layout.minX + layout.width / 2 : current.x;

    this.k.set(k);
    this.restingK = k;
    const tx = rect.width / 2 - cx * k;
    this.tx.set(this.fitsWhole ? tx : this.clampPan(tx, 0, k).tx);
    this.ty.set(groundScreen - this.groundY() * k);
    if (!this.focusedId()) {
      this.focusedId.set((current ?? layout.points[layout.points.length - 1]).node.id);
    }
  }

  /** The fitted zoom — with a mouse the tree stands still until zoomed in. */
  private restingK = 0;

  /** True when the whole tree fits the viewport at the resting zoom. */
  private fitsWhole = true;

  private panUnlocked(): boolean {
    // An overflowing tree must always be pannable — even with a mouse.
    return this.k() > this.restingK * 1.04 || !this.fitsWhole;
  }

  /** The tree can never wander out of sight: at least 120px of it stays visible. */
  private clampPan(tx: number, ty: number, k: number): { tx: number; ty: number } {
    const rect = this.svgRef().nativeElement.getBoundingClientRect();
    const l = this.layout();
    const margin = 120;
    const left = l.minX * k;
    const right = (l.minX + l.width) * k;
    const top = l.minY * k;
    const bottom = (l.minY + l.height) * k;
    const txMin = Math.min(margin - right, rect.width - margin - left);
    const txMax = Math.max(margin - right, rect.width - margin - left);
    const tyMin = Math.min(margin - bottom, rect.height - margin - top);
    const tyMax = Math.max(margin - bottom, rect.height - margin - top);
    return {
      tx: Math.min(txMax, Math.max(txMin, tx)),
      ty: Math.min(tyMax, Math.max(tyMin, ty)),
    };
  }

  /** Zoom around the viewport center (the +/− buttons). */
  zoomBy(factor: number): void {
    const rect = this.svgRef().nativeElement.getBoundingClientRect();
    const mx = rect.width / 2;
    const my = rect.height / 2;
    const k = Math.min(2.5, Math.max(0.4, this.k() * factor));
    const ratio = k / this.k();
    const c = this.clampPan(mx - ratio * (mx - this.tx()), my - ratio * (my - this.ty()), k);
    this.tx.set(c.tx);
    this.ty.set(c.ty);
    this.k.set(k);
  }

  /* ------------------------------------------------------------------ */
  /* Pointer pan / pinch                                                 */
  /* ------------------------------------------------------------------ */

  protected onPointerDown(ev: PointerEvent): void {
    try {
      (ev.target as Element).setPointerCapture?.(ev.pointerId);
    } catch {
      /* synthetic or already-released pointer — capture is best-effort */
    }
    this.pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    this.movedSinceDown = false;
    if (this.pointers.size === 1) {
      this.panStart = { x: ev.clientX, y: ev.clientY, tx: this.tx(), ty: this.ty() };
      this.pinchStart = null;
    } else if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.pinchStart = {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        k: this.k(),
        midX: (a.x + b.x) / 2,
        midY: (a.y + b.y) / 2,
        tx: this.tx(),
        ty: this.ty(),
      };
      this.panStart = null;
    }
  }

  protected onPointerMove(ev: PointerEvent): void {
    if (!this.pointers.has(ev.pointerId)) return;
    this.pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });

    if (this.pointers.size === 1 && this.panStart) {
      const dx = ev.clientX - this.panStart.x;
      const dy = ev.clientY - this.panStart.y;
      if (Math.abs(dx) + Math.abs(dy) > 6) this.movedSinceDown = true;
      // Fingers always pan (within the corral); a mouse only pans once zoomed in.
      if (ev.pointerType !== 'mouse' || this.panUnlocked()) {
        const c = this.clampPan(this.panStart.tx + dx, this.panStart.ty + dy, this.k());
        this.tx.set(c.tx);
        this.ty.set(c.ty);
      }
    } else if (this.pointers.size === 2 && this.pinchStart) {
      this.movedSinceDown = true;
      const [a, b] = [...this.pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const scale = dist / this.pinchStart.dist;
      const k = Math.min(2.5, Math.max(0.4, this.pinchStart.k * scale));
      const ratio = k / this.pinchStart.k;
      const rect = this.svgRef().nativeElement.getBoundingClientRect();
      const mx = this.pinchStart.midX - rect.left;
      const my = this.pinchStart.midY - rect.top;
      this.k.set(k);
      const c = this.clampPan(
        mx - ratio * (mx - this.pinchStart.tx),
        my - ratio * (my - this.pinchStart.ty),
        k,
      );
      this.tx.set(c.tx);
      this.ty.set(c.ty);
    }
  }

  protected onPointerUp(ev: PointerEvent): void {
    this.pointers.delete(ev.pointerId);
    if (this.pointers.size < 2) this.pinchStart = null;
    if (this.pointers.size === 0) this.panStart = null;
    if (this.pointers.size === 1) {
      const [p] = [...this.pointers.values()];
      this.panStart = { x: p.x, y: p.y, tx: this.tx(), ty: this.ty() };
    }
  }

  /** Taps resolve at the CANVAS level to the nearest node center, so a
   *  neighbor's invisible hit disc can never swallow a tap — the effective
   *  target is each node's Voronoi cell. Drags never count as taps; the
   *  note-mark and the "+" bud win when hit directly (they stop propagation,
   *  and the guard below covers any future refactor). */
  protected onCanvasClick(ev: MouseEvent): void {
    if (this.movedSinceDown) return;
    if ((ev.target as Element).closest?.('.note-mark, .plant-bud')) return;
    const rect = this.svgRef().nativeElement.getBoundingClientRect();
    const k = this.k();
    const wx = (ev.clientX - rect.left - this.tx()) / k;
    const wy = (ev.clientY - rect.top - this.ty()) / k;
    let best: LayoutPoint | null = null;
    let bestD = Infinity;
    for (const p of this.layout().points) {
      const d = Math.hypot(p.x - wx, p.y - wy);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    // Reach: at least 28 screen px, at least 20 world units.
    if (!best || bestD > Math.max(28 / k, 20)) return;
    this.focusNode(best.node.id);
    this.nodeOpened.emit(best.node);
  }

  protected onWheel(ev: WheelEvent): void {
    ev.preventDefault();
    const rect = this.svgRef().nativeElement.getBoundingClientRect();
    if (ev.ctrlKey || ev.metaKey) {
      const factor = ev.deltaY < 0 ? 1.12 : 1 / 1.12;
      const k = Math.min(2.5, Math.max(0.4, this.k() * factor));
      const ratio = k / this.k();
      const mx = ev.clientX - rect.left;
      const my = ev.clientY - rect.top;
      const c = this.clampPan(mx - ratio * (mx - this.tx()), my - ratio * (my - this.ty()), k);
      this.tx.set(c.tx);
      this.ty.set(c.ty);
      this.k.set(k);
    } else {
      const c = this.clampPan(this.tx() - ev.deltaX * 0.6, this.ty() - ev.deltaY * 0.6, this.k());
      this.ty.set(c.ty);
      this.tx.set(c.tx);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Keyboard navigation (roving tabindex)                               */
  /* ------------------------------------------------------------------ */

  protected onNodeKeydown(ev: KeyboardEvent, point: LayoutPoint): void {
    const move = (target: LayoutPoint | null | undefined) => {
      if (!target) return;
      ev.preventDefault();
      this.focusNode(target.node.id);
    };

    switch (ev.key) {
      case 'ArrowDown':
        move(point.parent);
        break;
      case 'ArrowUp': {
        // Up a chain link continues the path; otherwise into the first child.
        const upId = point.chainNextId ?? this.nodes.childrenOf(point.node)[0]?.id;
        move(upId ? this.layout().byId.get(upId) : null);
        break;
      }
      case 'ArrowLeft':
      case 'ArrowRight': {
        const siblings = point.parent
          ? this.nodes.childrenOf(point.parent.node)
          : this.nodes.rootsOf(this.tree().id);
        const idx = siblings.findIndex((s) => s.id === point.node.id);
        const next = siblings[idx + (ev.key === 'ArrowRight' ? 1 : -1)];
        move(next ? this.layout().byId.get(next.id) : null);
        break;
      }
      case 'Home': {
        const currentId = this.tree().currentNodeId;
        if (currentId) move(this.layout().byId.get(currentId));
        break;
      }
      case '+':
      case 'p':
        ev.preventDefault();
        this.plantRequested.emit(point.node);
        break;
      case 'Enter':
      case ' ':
        ev.preventDefault();
        this.nodeOpened.emit(point.node);
        break;
    }
  }

  focusNode(id: string): void {
    this.focusedId.set(id);
    const point = this.layout().byId.get(id);
    if (point) this.panIntoView(point);
    queueMicrotask(() => {
      this.host.nativeElement
        .querySelector<SVGGElement>(`[data-node-id="${id}"]`)
        ?.focus();
    });
  }

  private panIntoView(point: LayoutPoint): void {
    const rect = this.svgRef().nativeElement.getBoundingClientRect();
    const sx = point.x * this.k() + this.tx();
    const sy = point.y * this.k() + this.ty();
    const margin = 80;
    let dx = 0;
    let dy = 0;
    if (sx < margin) dx = margin - sx;
    if (sx > rect.width - margin) dx = rect.width - margin - sx;
    if (sy < margin) dy = margin - sy;
    if (sy > rect.height - margin) dy = rect.height - margin - sy;
    this.tx.set(this.tx() + dx);
    this.ty.set(this.ty() + dy);
  }
}
