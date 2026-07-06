import { Component, computed, inject, input } from '@angular/core';
import { Tree } from '../../core/db/schema';
import { NodesRepo } from '../../core/repos/nodes.repo';
import { FlowerSpec, flowerFor } from './flora';
import { FlowerGlyph } from './flower';
import {
  LayoutPoint,
  edgeGeometry,
  edgePointAt,
  hash as hashAngle,
  layoutTree,
  taperedRibbon,
  widthForMass,
} from './tree-layout';
import { formFor } from './tree-forms';

interface MiniBranch {
  d: string;
  fill: string;
}

interface MiniDot {
  x: number;
  y: number;
  kind: 'bloom' | 'bud' | 'pad' | 'leaf' | 'knot';
  angle?: number;
  size?: number;
}

interface MiniView {
  branches: MiniBranch[];
  trunk: string;
  dots: MiniDot[];
}

const W = 140;
const H = 160;
const GROUND = 150;
const PAD = 12;

/**
 * A real miniature of a tree, rendered from its actual data with the same
 * ribbon engine as the big canvas — a lush tree looks lush in the forest,
 * an empty one is a sapling. Purely decorative (the plot link labels it).
 */
@Component({
  selector: 'app-mini-tree',
  imports: [FlowerGlyph],
  template: `
    <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" aria-hidden="true" class="mini">
      @if (view(); as v) {
        <path class="trunk" [attr.d]="v.trunk" />
        @for (branch of v.branches; track $index) {
          <path [attr.d]="branch.d" [style.fill]="branch.fill" />
        }
        @for (dot of v.dots; track $index) {
          @if (dot.kind === 'bloom') {
            <g [attr.transform]="'translate(' + dot.x + ' ' + dot.y + ')'">
              <g appFlower [flower]="species()" [scale]="0.52" />
            </g>
          } @else if (dot.kind === 'knot') {
            <g [attr.transform]="'translate(' + dot.x + ' ' + dot.y + ')'">
              <circle r="4.4" class="knot-ring" />
              <circle r="1.7" class="knot-core" />
            </g>
          } @else if (dot.kind === 'bud') {
            <circle [attr.cx]="dot.x" [attr.cy]="dot.y" r="2.1" class="bud" />
          } @else if (dot.kind === 'leaf') {
            <path
              class="branch-leaf"
              [attr.transform]="'translate(' + dot.x + ' ' + dot.y + ') rotate(' + (dot.angle ?? 0) + ')'"
              [attr.d]="'M 0 0 Q ' + dot.size + ' ' + (-dot.size!) + ' 0 ' + (-2 * dot.size!) + ' Q ' + (-dot.size!) + ' ' + (-dot.size!) + ' 0 0 Z'"
            />
          } @else {
            <ellipse
              class="mini-pad"
              [attr.cx]="dot.x"
              [attr.cy]="dot.y"
              [attr.rx]="dot.size ?? 4"
              [attr.ry]="(dot.size ?? 4) * 0.62"
              [attr.transform]="'rotate(' + (dot.angle ?? 0) + ' ' + dot.x + ' ' + dot.y + ')'"
            />
          }
        }
      } @else {
        <!-- Sapling: this tree is waiting for its first branch -->
        <g class="sapling" [attr.transform]="'translate(' + W / 2 + ' ' + GROUND + ')'">
          <path d="M 0 0 C -1 -8 1 -14 0 -22" />
          <path d="M 0 -14 Q -9 -18 -11 -26 Q -2 -25 0 -14 Z" class="leaf" />
          <path d="M 0 -18 Q 8 -21 10 -29 Q 2 -28 0 -18 Z" class="leaf lighter" />
        </g>
      }
    </svg>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }
    .mini {
      width: 100%;
      height: auto;
      display: block;
      overflow: visible;
    }
    .trunk {
      fill: var(--rm-bark, #6f5640);
    }
    .petal {
      fill: color-mix(in srgb, var(--status-achieved) 72%, white);
    }
    .heart {
      fill: var(--status-branched);
    }
    .bud {
      fill: var(--status-growing);
    }
    .branch-leaf {
      fill: color-mix(in srgb, var(--status-growing) 78%, var(--surface, #fdfbf3));
      opacity: 0.9;
    }
    .knot-ring {
      fill: var(--surface, #fdfbf3);
      stroke: var(--status-branched);
      stroke-width: 2;
    }
    .knot-core {
      fill: var(--status-branched);
    }
    .mini-pad {
      fill: color-mix(in srgb, var(--rm-twig, #7f9a63) 85%, var(--status-growing));
      opacity: 0.82;
    }
    .sapling path {
      fill: none;
      stroke: var(--status-growing);
      stroke-width: 2.4;
      stroke-linecap: round;
    }
    .sapling .leaf {
      fill: var(--status-growing);
      stroke: none;
      opacity: 0.85;
    }
    .sapling .leaf.lighter {
      opacity: 0.6;
    }
  `,
})
export class MiniTree {
  readonly tree = input.required<Tree>();

  protected readonly species = computed<FlowerSpec>(() => flowerFor(this.tree().accent));

  protected readonly W = W;
  protected readonly H = H;
  protected readonly GROUND = GROUND;

  private readonly nodes = inject(NodesRepo);

  protected readonly view = computed<MiniView | null>(() => {
    const roots = this.nodes.rootsOf(this.tree().id);
    if (!roots.length) return null;

    const layout = layoutTree(roots, (n) => this.nodes.childrenOf(n));

    // Fit the real layout into the viewBox, root row anchored to the ground.
    const spanW = Math.max(layout.width, 50);
    const spanH = Math.max(layout.height, 70);
    // Baby trees get a taller stem so they read as saplings, never as blocks.
    const trunkRoom = layout.points.length <= 2 ? 46 : 26;
    // SIZE IS EARNED here too: a sparse tree may not fill its box — the fit
    // cap grows with content (blooms weigh double), so a tall skinny sapling
    // can never render bigger than a worked, bloomed crown.
    const content =
      layout.points.length + 2 * layout.points.filter((p) => p.node.status === 'achieved').length;
    const cap = Math.min(0.68, 0.18 + 0.1 * Math.sqrt(content));
    const s = Math.min(cap, (W - PAD * 2) / spanW, (H - PAD * 2 - trunkRoom) / (spanH + trunkRoom));
    // Wood reads too wispy at miniature scale — thicken beyond linear.
    const wBoost = 1.6;
    const centerX = layout.minX + layout.width / 2;
    const maxY = layout.minY + layout.height;

    const sx = (x: number) => (x - centerX) * s + W / 2;
    const sy = (y: number) => (y - maxY) * s + (GROUND - trunkRoom * s - 4);

    // Scaled copies preserving parent links AND mass (edge geometry hashes
    // node ids, widths ride the mass — the mini keeps the big tree's soul).
    const scaled = new Map<string, LayoutPoint>();
    for (const p of layout.points) {
      scaled.set(p.node.id, { node: p.node, x: sx(p.x), y: sy(p.y), depth: p.depth, parent: null, mass: p.mass });
    }
    for (const p of layout.points) {
      if (p.parent) scaled.get(p.node.id)!.parent = scaled.get(p.parent.node.id)!;
    }
    const form = formFor(this.tree().accent);

    const branches: MiniBranch[] = [];
    const dots: MiniDot[] = [];
    let trunk = '';

    for (const p of layout.points) {
      const sp = scaled.get(p.node.id)!;

      if (!sp.parent) {
        const len = Math.max(14, GROUND - sp.y);
        const isBaby = layout.points.length <= 2;
        // Grown trees: trunk top matches the branches' root width (visual
        // continuity, no cut). Babies: slender stem proportional to length.
        const wTop = isBaby
          ? Math.max(2.6, len * 0.2)
          : Math.max(3, widthForMass(sp.mass ?? 1, form.girthMul) * 0.9 * s * wBoost);
        const w0 = Math.min(26, wTop * (isBaby ? 1.5 : 1.35));
        const sway = (((hashAngle(p.node.id + ':sway') % 11) - 5) * len) / 70;
        trunk = taperedRibbon(
          sp.x + sway,
          GROUND + 2,
          sp.x + sway * 0.5,
          GROUND - len * 0.4,
          sp.x - sway * 0.3,
          sp.y + len * 0.35,
          sp.x,
          sp.y,
          w0,
          wTop,
        );
      } else {
        const geometry = edgeGeometry(sp.parent, sp, s * 0.9, {
          upBias: form.upBias,
          bowMul: form.bowMul,
        });
        const isLeaf = this.nodes.childrenOf(p.node).length === 0;
        const w0 = Math.max(2.8, widthForMass(sp.parent.mass ?? 1, form.girthMul) * 0.82 * s * wBoost);
        const w1 = Math.max(1.8, widthForMass(sp.mass ?? 1, form.girthMul) * (isLeaf ? 0.45 : 0.9) * s * wBoost);
        branches.push({
          d: taperedRibbon(sp.parent.x, sp.parent.y, geometry.c1x, geometry.c1y, geometry.c2x, geometry.c2y, sp.x, sp.y, w0, w1),
          fill: this.woodFill(sp),
        });

        // Little leaves along live branches — the big tree's charm, miniaturized.
        if (p.node.status !== 'resting') {
          const h = hashAngle(p.node.id + ':mleaf');
          const base = p.node.status === 'achieved' || p.node.status === 'growing' ? 2 : 1;
          const count = Math.max(1, Math.round(base * form.leafDensityMul));
          for (let i = 0; i < count; i++) {
            const hi = hashAngle(p.node.id + ':mleaf:' + i);
            const t = 0.4 + ((hi % 45) / 100);
            const at = edgePointAt(sp.parent, sp, geometry, t);
            const side = (h + i) % 2 === 0 ? 1 : -1;
            dots.push({
              x: at.x + side * 2.5,
              y: at.y,
              kind: 'leaf',
              angle: side * (35 + (hi % 40)),
              size: 3 + ((hi >> 4) % 2),
            });
          }
        }

        // Tip pads — the crown's volume, per the tree's porte.
        if (isLeaf && p.node.status !== 'resting') {
          const hp = hashAngle(p.node.id + ':mpad');
          const padN = form.id === 'acacia' ? 2 : form.id === 'oak' ? 2 : 1;
          for (let i = 0; i < padN; i++) {
            dots.push({
              x: sp.x + ((hashAngle(p.node.id + ':mpad:' + i) % 9) - 4),
              y: sp.y - 2 - i * 3,
              kind: 'pad',
              angle: (hp % 25) - 12,
              size: form.id === 'acacia' ? 6.5 : form.id === 'oak' ? 4.8 : 3.6,
            });
          }
        }
      }

      if (p.node.status === 'achieved') {
        dots.push({ x: sp.x, y: sp.y, kind: 'bloom' });
      } else if (p.node.status === 'branched') {
        dots.push({ x: sp.x, y: sp.y, kind: 'knot' });
      } else if (p.node.status === 'growing') {
        dots.push({ x: sp.x, y: sp.y, kind: 'bud' });
      }
    }

    return { branches, trunk, dots };
  });

  private woodFill(point: LayoutPoint): string {
    const barkPct = Math.max(30, 92 - point.depth * 16);
    const base = `color-mix(in srgb, var(--rm-bark, #6f5640) ${barkPct}%, var(--rm-twig, #7f9a63))`;
    return point.node.origin === 'branch'
      ? `color-mix(in srgb, ${base} 72%, var(--status-branched))`
      : base;
  }
}
