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
  LayoutPoint,
  branchRibbon,
  edgeGeometry,
  edgePointAt,
  hash,
  layoutTree,
  taperedRibbon,
  widthAtDepth,
} from './tree-layout';
import { FlowerSpec, flowerFor } from './flora';
import { FlowerGlyph } from './flower';

interface LeafDecoration {
  x: number;
  y: number;
  angle: number;
  size: number;
  kind: 'leaf' | 'blossom';
}

interface EdgeView {
  id: string;
  d: string;
  fill: string;
  isNew: boolean;
  leaves: LeafDecoration[];
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

  /** Roving tabindex focus (also drives the "+" bud). */
  protected readonly focusedId = signal<string | null>(null);

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

  protected readonly edges = computed<EdgeView[]>(() =>
    this.layout()
      .points.filter((p) => p.parent !== null)
      .map((p) => {
        const geometry = edgeGeometry(p.parent!, p);
        const isLeaf = this.nodes.childrenOf(p.node).length === 0;
        return {
          id: p.node.id,
          d: branchRibbon(p.parent!, p, geometry, isLeaf),
          fill: this.woodFill(p),
          isNew: this.bornThisSession.has(p.node.id),
          leaves: this.leavesFor(p, geometry, isLeaf),
        };
      }),
  );

  /** Bark near the trunk, greener toward the twigs; branch-children lean golden. */
  private woodFill(point: LayoutPoint): string {
    const barkPct = Math.max(30, 92 - point.depth * 16);
    const base = `color-mix(in srgb, var(--rm-bark) ${barkPct}%, var(--rm-twig))`;
    return point.node.origin === 'branch'
      ? `color-mix(in srgb, ${base} 72%, var(--status-branched))`
      : base;
  }

  /** Trunk ribbon: ground → root, with a gentle sway. */
  protected trunkPath(root: LayoutPoint): string {
    const gy = this.groundY();
    const sway = ((hash(root.node.id + ':trunk') % 21) - 10) * 0.6;
    return taperedRibbon(
      root.x + sway,
      gy - 2,
      root.x + sway * 0.4,
      gy - (gy - root.y) * 0.4,
      root.x - sway * 0.3,
      root.y + (gy - root.y) * 0.35,
      root.x,
      root.y,
      26,
      widthAtDepth(0) * 0.9,
    );
  }

  /** Deterministic foliage: leaf slots scale with limb length, some sprout
   *  opposite twins (leaf pairs), and twig tips gather a tuft. */
  private leavesFor(
    point: LayoutPoint,
    geometry: ReturnType<typeof edgeGeometry>,
    isTip: boolean,
  ): LeafDecoration[] {
    const status = point.node.status;
    const h = hash(point.node.id + ':leaves');
    const parent = point.parent!;
    const length = Math.hypot(point.x - parent.x, point.y - parent.y);
    // One leaf slot every ~10-14px of limb; resting stays deliberately sparse.
    const spacing = status === 'achieved' ? 10 : status === 'growing' ? 11 : status === 'resting' ? 30 : 14;
    const slots = Math.max(status === 'resting' ? 2 : 4, Math.min(14, Math.round(length / spacing)));
    const leaves: LeafDecoration[] = [];
    for (let i = 0; i < slots; i++) {
      const hi = hash(point.node.id + ':leaf:' + i);
      const t = Math.min(0.93, 0.16 + (i / slots) * 0.72 + ((hi % 10) / 100));
      const at = edgePointAt(parent, point, geometry, t);
      const side = (i + (h % 2)) % 2 === 0 ? 1 : -1;
      leaves.push({
        x: at.x + side * (3 + (hi % 6)),
        y: at.y,
        angle: side * (26 + (hi % 55)),
        size: 5 + ((hi >> 4) % 4),
        kind: status === 'achieved' && i === 0 ? 'blossom' : 'leaf',
      });
      // Some slots sprout an opposite twin — pairs read as real foliage.
      if (hi % 5 < 2 && status !== 'resting') {
        leaves.push({
          x: at.x - side * (3 + ((hi >> 3) % 5)),
          y: at.y + 1,
          angle: -side * (30 + ((hi >> 5) % 45)),
          size: 4.5 + ((hi >> 7) % 3),
          kind: 'leaf',
        });
      }
    }
    // Foliage gathers where the branch ends: twig tips grow a real tuft.
    if (isTip && status !== 'achieved' && status !== 'branched') {
      const tuftCount = status === 'resting' ? 2 : 4 + (h % 2);
      for (let i = 0; i < tuftCount; i++) {
        const hi = hash(point.node.id + ':tuft:' + i);
        const at = edgePointAt(parent, point, geometry, Math.min(0.97, 0.8 + i * 0.045));
        const side = i % 2 === 0 ? 1 : -1;
        leaves.push({
          x: at.x + side * (2 + (hi % 5)),
          y: at.y,
          angle: side * (14 + (hi % 46)),
          size: 4.5 + (hi % 4),
          kind: 'leaf',
        });
      }
    }
    return leaves;
  }

  private readonly pointers = new Map<number, { x: number; y: number }>();
  private pinchStart: { dist: number; k: number; midX: number; midY: number; tx: number; ty: number } | null = null;
  private panStart: { x: number; y: number; tx: number; ty: number } | null = null;
  private movedSinceDown = false;

  constructor() {
    // Track newborn nodes for the grow animation.
    effect(() => {
      const ids = new Set(this.layout().points.map((p) => p.node.id));
      if (this.knownIds) {
        for (const id of ids) {
          if (!this.knownIds.has(id)) this.bornThisSession.add(id);
        }
      }
      this.knownIds = ids;
    });

    // Fit + center when the tree changes.
    effect(() => {
      this.tree();
      queueMicrotask(() => this.centerOnCurrent());
    });
  }

  /* ------------------------------------------------------------------ */
  /* View helpers                                                        */
  /* ------------------------------------------------------------------ */

  protected transform(): string {
    return `translate(${this.tx()} ${this.ty()}) scale(${this.k()})`;
  }

  protected statusColor(node: TreeNode): string {
    return `var(--status-${node.status})`;
  }

  protected hitRadius(): number {
    return Math.min(44, Math.max(18, 26 / this.k()));
  }

  protected showLabel(point: LayoutPoint): boolean {
    // The focused node shows the "+" bud instead — its sheet carries the name.
    if (this.focusedId() === point.node.id) return false;
    if (this.tree().currentNodeId === point.node.id) return true;
    return this.k() >= 0.55;
  }

  /** Deterministic horizontal nudge so sibling labels stop stacking. */
  protected labelX(point: LayoutPoint): number {
    if (point.depth === 0) return 0;
    return (hash(point.node.id + ':lx') % 21) - 10;
  }

  protected labelText(point: LayoutPoint): string {
    const title = point.node.title;
    return title.length > 20 ? title.slice(0, 19) + '…' : title;
  }

  /** Alternate label offsets so close siblings don't collide. */
  protected labelY(point: LayoutPoint): number {
    return hash(point.node.id + ':label') % 2 === 0 ? 27 : 40;
  }

  protected nodeLabel(point: LayoutPoint): string {
    const t = this.i18n.t();
    const children = this.nodes.childrenOf(point.node).length;
    let label = this.i18n.fill(t.a11y.nodeLabel, {
      title: point.node.title,
      status: t.status[point.node.status],
    });
    if (children) label += `, ${this.i18n.fill(t.a11y.withChildren, { count: children })}`;
    return label;
  }

  centerOnCurrent(): void {
    const layout = this.layout();
    if (!layout.points.length) return;
    const svg = this.svgRef().nativeElement;
    const rect = svg.getBoundingClientRect();
    if (!rect.width) return;

    // The tree STANDS on the scenery's meadow line — never floats.
    const groundScreen = rect.height * 0.8;
    const pad = 100;
    const fitK = Math.min(
      rect.width / (layout.width + pad * 2),
      (groundScreen - 70) / (layout.height + 90),
    );
    // Young trees should still fill the view instead of drowning in it.
    const fillK = (rect.height * 0.42) / Math.max(layout.height + 60, 180);
    const k = Math.min(1.6, Math.max(0.4, Math.min(fitK, Math.max(1.15, fillK))));

    const currentId = this.tree().currentNodeId;
    const target = (currentId && layout.byId.get(currentId)) || layout.points[layout.points.length - 1];

    this.k.set(k);
    this.tx.set(rect.width / 2 - target.x * k);
    this.ty.set(groundScreen - this.groundY() * k);
    if (!this.focusedId()) this.focusedId.set(target.node.id);
  }

  /* ------------------------------------------------------------------ */
  /* Pointer pan / pinch                                                 */
  /* ------------------------------------------------------------------ */

  protected onPointerDown(ev: PointerEvent): void {
    (ev.target as Element).setPointerCapture?.(ev.pointerId);
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
      this.tx.set(this.panStart.tx + dx);
      this.ty.set(this.panStart.ty + dy);
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
      this.tx.set(mx - ratio * (mx - this.pinchStart.tx));
      this.ty.set(my - ratio * (my - this.pinchStart.ty));
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

  /** A drag should never count as a tap on a node. */
  protected onNodeClick(point: LayoutPoint): void {
    if (this.movedSinceDown) return;
    if (this.focusedId() === point.node.id) {
      this.nodeOpened.emit(point.node);
    } else {
      this.focusNode(point.node.id);
    }
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
      this.tx.set(mx - ratio * (mx - this.tx()));
      this.ty.set(my - ratio * (my - this.ty()));
      this.k.set(k);
    } else {
      this.ty.set(this.ty() - ev.deltaY * 0.6);
      this.tx.set(this.tx() - ev.deltaX * 0.6);
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
        const children = this.nodes.childrenOf(point.node);
        move(children.length ? this.layout().byId.get(children[0].id) : null);
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

  protected focusNode(id: string): void {
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
