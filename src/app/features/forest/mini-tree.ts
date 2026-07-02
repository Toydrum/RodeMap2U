import { Component, computed, inject, input } from '@angular/core';
import { Tree } from '../../core/db/schema';
import { NodesRepo } from '../../core/repos/nodes.repo';
import { LayoutPoint, edgeGeometry, hash as hashAngle, layoutTree, taperedRibbon, widthAtDepth } from './tree-layout';

interface MiniBranch {
  d: string;
  fill: string;
}

interface MiniDot {
  x: number;
  y: number;
  kind: 'bloom' | 'bud' | 'foliage';
  angle?: number;
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
              @for (angle of [0, 72, 144, 216, 288]; track angle) {
                <ellipse rx="2.2" ry="3.6" cy="-3.2" [attr.transform]="'rotate(' + angle + ')'" class="petal" />
              }
              <circle r="1.9" class="heart" />
            </g>
          } @else if (dot.kind === 'bud') {
            <circle [attr.cx]="dot.x" [attr.cy]="dot.y" r="2.1" class="bud" />
          } @else {
            <g [attr.transform]="'translate(' + dot.x + ' ' + dot.y + ') rotate(' + (dot.angle ?? 0) + ')'" class="foliage">
              <ellipse rx="3.2" ry="5.2" cy="-4.4" transform="rotate(-24)" />
              <ellipse rx="2.6" ry="4.4" cy="-3.8" transform="rotate(30)" class="lighter" />
            </g>
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
    .foliage ellipse {
      fill: color-mix(in srgb, var(--rm-twig, #7f9a63) 85%, var(--status-growing));
      opacity: 0.9;
    }
    .foliage .lighter {
      opacity: 0.65;
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
    const trunkRoom = 26;
    const s = Math.min(0.68, (W - PAD * 2) / spanW, (H - PAD * 2 - trunkRoom) / (spanH + trunkRoom));
    // Wood reads too wispy at miniature scale — thicken beyond linear.
    const wBoost = 1.6;
    const centerX = layout.minX + layout.width / 2;
    const maxY = layout.minY + layout.height;

    const sx = (x: number) => (x - centerX) * s + W / 2;
    const sy = (y: number) => (y - maxY) * s + (GROUND - trunkRoom * s - 4);

    // Scaled copies preserving parent links (edge geometry hashes node ids,
    // so the mini keeps the same organic personality as the big tree).
    const scaled = new Map<string, LayoutPoint>();
    for (const p of layout.points) {
      scaled.set(p.node.id, { node: p.node, x: sx(p.x), y: sy(p.y), depth: p.depth, parent: null });
    }
    for (const p of layout.points) {
      if (p.parent) scaled.get(p.node.id)!.parent = scaled.get(p.parent.node.id)!;
    }

    const branches: MiniBranch[] = [];
    const dots: MiniDot[] = [];
    let trunk = '';

    for (const p of layout.points) {
      const sp = scaled.get(p.node.id)!;

      if (!sp.parent) {
        trunk = taperedRibbon(
          sp.x,
          GROUND,
          sp.x,
          GROUND - trunkRoom * s * 2,
          sp.x,
          sp.y + 8,
          sp.x,
          sp.y,
          Math.max(7, 24 * s * wBoost),
          Math.max(3.4, widthAtDepth(0) * 0.85 * s * wBoost),
        );
      } else {
        const geometry = edgeGeometry(sp.parent, sp, s * 0.9);
        const isLeaf = this.nodes.childrenOf(p.node).length === 0;
        const w0 = Math.max(2.8, widthAtDepth(sp.parent.depth) * 0.82 * s * wBoost);
        const w1 = Math.max(1.8, widthAtDepth(sp.depth) * (isLeaf ? 0.45 : 0.82) * s * wBoost);
        branches.push({
          d: taperedRibbon(sp.parent.x, sp.parent.y, geometry.c1x, geometry.c1y, geometry.c2x, geometry.c2y, sp.x, sp.y, w0, w1),
          fill: this.woodFill(sp),
        });
      }

      if (p.node.status === 'achieved') {
        dots.push({ x: sp.x, y: sp.y, kind: 'bloom' });
      } else if (p.node.status === 'growing') {
        dots.push({ x: sp.x, y: sp.y, kind: 'bud' });
      } else if (this.nodes.childrenOf(p.node).length === 0) {
        // Bare tips get a leaf sprig — no winter saplings.
        dots.push({ x: sp.x, y: sp.y, kind: 'foliage', angle: (hashAngle(p.node.id) % 70) - 35 });
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
