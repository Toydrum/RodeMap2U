import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { TreesRepo } from '../../core/repos/trees.repo';
import { NodesRepo } from '../../core/repos/nodes.repo';
import { CheckinsRepo } from '../../core/repos/checkins.repo';
import { ToastService, UNDO_MS } from '../../shared/ui/toast.service';
import { AccentToken, Feeling, Tree } from '../../core/db/schema';
import { hash, taperedRibbon } from './tree-layout';
import { MiniTree } from './mini-tree';
import { SceneBackdrop } from './scene-backdrop';
import { WeatherFront } from './weather-front';
import { SheetDirective } from '../../shared/ui/sheet.directive';
import { FlowerSpec, flowerFor } from './flora';
import { FlowerGlyph } from './flower';

const ACCENTS: AccentToken[] = ['moss', 'sage', 'sky', 'clay', 'lavender', 'sand', 'rose', 'pine'];

interface SceneFlower {
  x: number;
  y: number;
  scale: number;
  spec: FlowerSpec;
  sway: number;
}

interface GrassTuft {
  x: number;
  y: number;
  s: number;
  rot: number;
  variant: number;
  shade: number;
  flip: boolean;
}

interface MeadowDecor {
  x: number;
  y: number;
  s: number;
  flip: boolean;
}

/** Fixed-seed scatter helper — same meadow every session, forever.
 *  Items deeper in the band (higher y) grow larger: cheap depth. */
function scatter(kind: string, count: number, xMin: number, xSpan: number, yMin: number, ySpan: number): MeadowDecor[] {
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

/**
 * "El Prado" — the forest home as a living scene. Every tree is a real
 * miniature of its data, standing on the meadow; a stream winds through
 * once three trees grow together, and a flower blooms per achieved goal.
 */
@Component({
  selector: 'app-forest',
  imports: [RouterLink, MiniTree, SceneBackdrop, WeatherFront, FlowerGlyph, SheetDirective],
  templateUrl: './forest.html',
  styleUrl: './forest.scss',
  // Drag listeners live on the document: live reordering moves the grip in
  // the DOM, which breaks pointer capture mid-drag.
  host: {
    '(document:pointermove)': 'moveOver($event)',
    '(document:pointerup)': 'endMove()',
    '(document:pointercancel)': 'endMove()',
  },
})
export class ForestPage {
  protected readonly i18n = inject(I18nService);
  protected readonly trees = inject(TreesRepo);
  protected readonly nodes = inject(NodesRepo);
  protected readonly accents = ACCENTS;

  protected readonly creating = signal(false);
  protected readonly newName = signal('');
  protected readonly newAccent = signal<AccentToken>('moss');
  /** Tree pending archive (confirm sheet open). */
  protected readonly archiving = signal<Tree | null>(null);
  private readonly toast = inject(ToastService);

  private readonly checkins = inject(CheckinsRepo);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  constructor() {
    // Check-in's empty-forest exit lands here ready to plant.
    if (this.route.snapshot.queryParamMap.has('plant')) {
      this.creating.set(true);
      const params = { ...this.route.snapshot.queryParams, plant: null };
      void this.router.navigate([], { queryParams: params, replaceUrl: true });
    }

    // Chromium treats document touchmove listeners as passive by default;
    // dragging needs a REAL preventDefault or the browser steals the gesture
    // for scrolling and fires pointercancel mid-drag.
    const lockTouch = (ev: TouchEvent) => {
      if (this.draggingId()) ev.preventDefault();
    };
    document.addEventListener('touchmove', lockTouch, { passive: false });
    inject(DestroyRef).onDestroy(() => document.removeEventListener('touchmove', lockTouch));
  }

  /** `?mood=` dev/demo override, else the latest check-in's feeling. */
  private readonly moodOverride = new URLSearchParams(location.search).get('mood') as Feeling | null;
  protected readonly mood = computed<Feeling | null>(
    () => this.moodOverride ?? this.checkins.latest()?.feeling ?? null,
  );

  /** The stream flows once the forest has three trees (winding ribbon + ripples). */
  protected readonly hasStream = computed(() => this.trees.active().length >= 3);

  protected readonly streamPath = taperedRibbon(1060, 96, 700, 168, 400, 76, -60, 208, 22, 46);
  protected readonly ripple1 = 'M 1040 104 C 720 170, 430 92, -40 202';
  protected readonly ripple2 = 'M 1045 118 C 735 185, 445 110, -45 218';

  /** One meadow flower per achieved goal — each in ITS tree's species. */
  protected readonly flowers = computed<SceneFlower[]>(() => {
    const achieved = this.nodes.visible().filter((n) => n.status === 'achieved');
    return achieved.slice(0, 26).map((node) => {
      const h = hash(node.id + ':meadow');
      const tree = this.trees.byId().get(node.treeId);
      return {
        x: 30 + (h % 940),
        y: 196 + ((h >> 8) % 52),
        scale: 0.42 + ((h >> 4) % 20) / 100,
        spec: flowerFor(tree?.accent ?? 'rose'),
        sway: -8 + (h % 17),
      };
    });
  });

  /** Grass grows in overlapping patches of varied tufts — that's the trick
   *  that reads as real grass instead of repeated stamps. Fixed-seed. */
  protected readonly grass: GrassTuft[] = (() => {
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
  protected readonly sunPatches = scatter('sunpatch', 4, 80, 820, 158, 66);
  protected readonly bushes = scatter('bush', 9, 160, 800, 198, 42);
  protected readonly richTufts = scatter('rich', 26, 10, 960, 198, 56);
  protected readonly spikes = scatter('spike', 20, 20, 950, 198, 56);
  protected readonly daisies = scatter('daisy', 14, 170, 790, 200, 52);
  protected readonly clovers = scatter('clover', 18, 175, 790, 206, 48);
  /** Hand-placed by the stream banks (only shown once the stream flows). */
  protected readonly cattails: MeadowDecor[] = [
    { x: 655, y: 152, s: 1, flip: false },
    { x: 268, y: 146, s: 0.85, flip: true },
    { x: 762, y: 150, s: 0.75, flip: true },
    { x: 398, y: 138, s: 0.65, flip: false },
  ];
  protected readonly stones: MeadowDecor[] = [
    { x: 868, y: 144, s: 1, flip: false },
    { x: 505, y: 146, s: 0.75, flip: true },
    { x: 122, y: 194, s: 0.9, flip: false },
    { x: 700, y: 150, s: 0.55, flip: false },
    { x: 232, y: 186, s: 0.65, flip: true },
  ];

  protected readonly petalAngles = [0, 72, 144, 216, 288];

  /* -------------------------------------------- arrange your own forest */

  /** Live order while dragging (ids); null when at rest. */
  protected readonly dragPreview = signal<string[] | null>(null);
  protected readonly draggingId = signal<string | null>(null);

  /** What the meadow renders: the drag preview if one is in flight. */
  protected readonly displayTrees = computed(() => {
    const base = this.trees.active();
    const preview = this.dragPreview();
    if (!preview) return base;
    const byId = new Map(base.map((t) => [t.id, t]));
    return preview.map((id) => byId.get(id)).filter((t): t is Tree => !!t);
  });

  /** Press pending on a plot: becomes a drag on movement (mouse) or after a
   *  long-press (touch); otherwise the tap navigates as always. */
  private pendingDrag: { tree: Tree; x: number; y: number; timer: ReturnType<typeof setTimeout> | null } | null = null;
  private suppressClick = false;

  protected plotDown(ev: PointerEvent, tree: Tree): void {
    this.suppressClick = false;
    this.dragMoved = false;
    if ((ev.target as Element).closest('.plot-archive')) return;
    const pending = { tree, x: ev.clientX, y: ev.clientY, timer: null as ReturnType<typeof setTimeout> | null };
    // Holding also lifts the tree (mouse a bit sooner than a finger) —
    // matching the natural "press and hold to grab it" instinct.
    pending.timer = setTimeout(
      () => {
        if (this.pendingDrag === pending) this.beginDrag(tree);
      },
      ev.pointerType === 'mouse' ? 250 : 350,
    );
    this.pendingDrag = pending;
  }

  /** True once the pointer really traveled during a drag. */
  private dragMoved = false;

  private beginDrag(tree: Tree): void {
    this.clearPending();
    // A lone tree has no neighbor to trade places with — say so kindly.
    if (this.trees.active().length < 2) {
      this.toast.show({ message: this.i18n.t().forest.moveNeedsTwo });
      return;
    }
    this.draggingId.set(tree.id);
    this.dragPreview.set(this.trees.active().map((t) => t.id));
    this.suppressClick = true;
  }

  private clearPending(): void {
    if (this.pendingDrag?.timer) clearTimeout(this.pendingDrag.timer);
    this.pendingDrag = null;
  }

  /** Swallow the click that follows a drag so the plot doesn't navigate. */
  protected plotClick(ev: MouseEvent): void {
    if (this.suppressClick) {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      this.suppressClick = false;
    }
  }

  protected moveOver(ev: PointerEvent): void {
    const pending = this.pendingDrag;
    if (pending && !this.draggingId()) {
      const dist = Math.hypot(ev.clientX - pending.x, ev.clientY - pending.y);
      if (ev.pointerType === 'mouse') {
        if (dist > 8) this.beginDrag(pending.tree);
      } else if (dist > 14) {
        // Finger slid before the long-press: that's a scroll, not a drag.
        this.clearPending();
      }
    }
    const dragId = this.draggingId();
    const preview = this.dragPreview();
    if (!dragId || !preview) return;
    this.dragMoved = true;
    for (const el of document.elementsFromPoint(ev.clientX, ev.clientY)) {
      const host = (el as Element).closest?.('[data-tree-id]') as HTMLElement | null;
      const overId = host?.dataset['treeId'];
      if (!overId || overId === dragId) continue;
      const from = preview.indexOf(dragId);
      const to = preview.indexOf(overId);
      if (from === -1 || to === -1 || from === to) return;
      const next = [...preview];
      next.splice(from, 1);
      next.splice(to, 0, dragId);
      this.dragPreview.set(next);
      return;
    }
  }

  protected async endMove(): Promise<void> {
    this.clearPending();
    if (!this.draggingId()) return;
    const preview = this.dragPreview();
    this.draggingId.set(null);
    this.dragPreview.set(null);
    // A hold that never traveled is just a slow click — let it navigate.
    if (!this.dragMoved) this.suppressClick = false;
    if (preview) await this.trees.setOrder(preview);
  }

  /** Keyboard rearranging: arrows swap the tree with its neighbor. */
  protected async nudge(ev: KeyboardEvent, tree: Tree): Promise<void> {
    const dir =
      ev.key === 'ArrowLeft' || ev.key === 'ArrowUp'
        ? -1
        : ev.key === 'ArrowRight' || ev.key === 'ArrowDown'
          ? 1
          : 0;
    if (!dir) return;
    ev.preventDefault();
    const ids = this.trees.active().map((t) => t.id);
    const i = ids.indexOf(tree.id);
    const j = i + dir;
    if (i === -1 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await this.trees.setOrder(ids);
  }

  /** Deterministic per-plot vertical offset — rows stop being ruler-straight. */
  protected staggerFor(treeId: string): number {
    return hash(treeId + ':stagger') % 22;
  }

  protected countFor(treeId: string): number {
    return (this.nodes.byTree().get(treeId) ?? []).length;
  }

  protected bloomsFor(treeId: string): number {
    return (this.nodes.byTree().get(treeId) ?? []).filter((n) => n.status === 'achieved').length;
  }

  protected askArchive(event: Event, tree: Tree): void {
    // The button lives inside the plot link — don't navigate.
    event.preventDefault();
    event.stopPropagation();
    this.archiving.set(tree);
  }

  protected async archiveTree(): Promise<void> {
    const tree = this.archiving();
    if (!tree) return;
    await this.trees.archive(tree);
    this.archiving.set(null);
    this.toast.show(
      {
        message: this.i18n.fill(this.i18n.t().tree.archivedToast, { name: tree.name }),
        actionLabel: this.i18n.t().common.undo,
        action: () => void this.trees.restore(tree),
      },
      UNDO_MS,
    );
  }

  protected async create(): Promise<void> {
    const name = this.newName().trim();
    if (!name) return;
    await this.trees.create(name, this.newAccent());
    this.newName.set('');
    this.creating.set(false);
  }
}
