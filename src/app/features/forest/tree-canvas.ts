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
import { LayoutPoint, edgePath, edgeWidth, layoutTree } from './tree-layout';

/**
 * The living map: SVG tree with organic edges, pointer pan/zoom (1 finger pan,
 * 2 finger pinch, ctrl-wheel zoom), roving-tabindex keyboard navigation and a
 * one-time "grow" animation for nodes born this session.
 */
@Component({
  selector: 'app-tree-canvas',
  templateUrl: './tree-canvas.html',
  styleUrl: './tree-canvas.scss',
})
export class TreeCanvas {
  readonly tree = input.required<Tree>();
  readonly nodeOpened = output<TreeNode>();

  protected readonly nodes = inject(NodesRepo);
  protected readonly i18n = inject(I18nService);
  protected readonly motion = inject(MotionService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly svgRef = viewChild.required<ElementRef<SVGSVGElement>>('svg');

  /** Pan/zoom state. */
  protected readonly tx = signal(0);
  protected readonly ty = signal(0);
  protected readonly k = signal(1);

  /** Roving tabindex focus. */
  protected readonly focusedId = signal<string | null>(null);

  /** Nodes created this session get the grow animation exactly once. */
  private readonly bornThisSession = new Set<string>();
  private knownIds: Set<string> | null = null;

  protected readonly layout = computed(() => {
    const tree = this.tree();
    const roots = this.nodes.rootsOf(tree.id);
    return layoutTree(roots, (n) => this.nodes.childrenOf(n));
  });

  protected readonly edges = computed(() =>
    this.layout()
      .points.filter((p) => p.parent !== null)
      .map((p) => ({
        id: p.node.id,
        d: edgePath(p.parent!, p),
        width: edgeWidth(p.depth),
        isBranchChild: p.node.origin === 'branch',
        isNew: this.bornThisSession.has(p.node.id),
      })),
  );

  private readonly pointers = new Map<number, { x: number; y: number }>();
  private pinchStart: { dist: number; k: number; midX: number; midY: number; tx: number; ty: number } | null = null;
  private panStart: { x: number; y: number; tx: number; ty: number } | null = null;

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
    return Math.min(40, Math.max(16, 24 / this.k()));
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

    // Fit whole tree, capped zoom.
    const pad = 90;
    const fitK = Math.min(
      1.15,
      rect.width / (layout.width + pad * 2),
      rect.height / (layout.height + pad * 2),
    );
    const k = Math.max(0.4, fitK);

    const currentId = this.tree().currentNodeId;
    const target = (currentId && layout.byId.get(currentId)) || layout.points[layout.points.length - 1];

    this.k.set(k);
    this.tx.set(rect.width / 2 - target.x * k);
    this.ty.set(rect.height * 0.62 - target.y * k);
    if (!this.focusedId()) this.focusedId.set(target.node.id);
  }

  /* ------------------------------------------------------------------ */
  /* Pointer pan / pinch                                                 */
  /* ------------------------------------------------------------------ */

  protected onPointerDown(ev: PointerEvent): void {
    (ev.target as Element).setPointerCapture?.(ev.pointerId);
    this.pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
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
      this.tx.set(this.panStart.tx + ev.clientX - this.panStart.x);
      this.ty.set(this.panStart.ty + ev.clientY - this.panStart.y);
    } else if (this.pointers.size === 2 && this.pinchStart) {
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
    const margin = 70;
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
