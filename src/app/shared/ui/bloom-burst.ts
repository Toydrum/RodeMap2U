import { Component, Injectable, inject, signal } from '@angular/core';
import type { FlowerSpec } from '../../features/forest/flora';

/**
 * «El estallido» (0.0.88) — the foreground bloom celebration: a small
 * one-shot burst of petals in the tree's own flower palette, played at the
 * exact point the user tapped. It rides ABOVE sheets (the canvas fruit
 * drop plays behind them and phones barely see it), and it fires at every
 * bloom site — pasito 🌸, the status picker, the almanaque stone — with
 * EQUAL DIGNITY: fixed angles, identical for every bloom, forever. No
 * escalation, no combos, no sound. Reduce-motion: a single soft ring fade.
 *
 * Self-styled + host-rendered like the toast (shared components carry
 * their OWN styles — the 0.0.77 ConfirmSheet law).
 */

export interface BloomBurst {
  id: number;
  /** Viewport px — the tapped element's center. */
  x: number;
  y: number;
  species: FlowerSpec;
}

@Injectable({ providedIn: 'root' })
export class BloomBurstService {
  readonly bursts = signal<BloomBurst[]>([]);
  private seq = 0;

  /** Play one burst at the element's center. Null/detached targets no-op. */
  burstAt(el: Element | null | undefined, species: FlowerSpec): void {
    const rect = el?.getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) return;
    const burst: BloomBurst = {
      id: ++this.seq,
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      species,
    };
    this.bursts.update((list) => [...list, burst]);
    setTimeout(() => {
      this.bursts.update((list) => list.filter((b) => b !== burst));
    }, 900);
  }
}

/** Fixed geometry — deterministic and identical every time (predictability
 *  is the celebration's spine; only the species colors change). */
const PETALS = [
  { angle: 0, dist: 24 },
  { angle: 60, dist: 21 },
  { angle: 120, dist: 25 },
  { angle: 180, dist: 22 },
  { angle: 240, dist: 24 },
  { angle: 300, dist: 21 },
];
const SPARKS = [
  { angle: 30, dist: 16 },
  { angle: 210, dist: 17 },
];

@Component({
  selector: 'app-bloom-burst-host',
  styles: `
    .bloom-burst {
      position: fixed;
      z-index: 700;
      pointer-events: none;
      transform: translate(-50%, -50%);
    }

    .burst-ring {
      transform-origin: center;
      animation: burst-ring 0.65s ease-out both;
    }

    .burst-petal,
    .burst-spark {
      animation: burst-fly 0.7s cubic-bezier(0.2, 0.7, 0.35, 1) both;
    }

    @keyframes burst-ring {
      0% {
        transform: scale(0.4);
        opacity: 0.55;
      }
      100% {
        transform: scale(1.9);
        opacity: 0;
      }
    }

    @keyframes burst-fly {
      0% {
        transform: rotate(var(--ba)) translateY(-4px) scale(0.4);
        opacity: 0;
      }
      18% {
        opacity: 1;
      }
      72% {
        opacity: 0.9;
      }
      100% {
        transform: rotate(var(--ba)) translateY(calc(var(--bd) * -1)) scale(1);
        opacity: 0;
      }
    }

    /* Reduce-motion: no particles — one soft, still ring that breathes out. */
    :host-context(.reduce-motion) {
      .burst-petal,
      .burst-spark {
        display: none;
      }

      .burst-ring {
        animation: burst-ring-soft 0.45s ease-out both;
      }
    }

    @keyframes burst-ring-soft {
      0% {
        opacity: 0.5;
      }
      100% {
        opacity: 0;
      }
    }
  `,
  template: `
    @for (burst of service.bursts(); track burst.id) {
      <div class="bloom-burst" aria-hidden="true" [style.left.px]="burst.x" [style.top.px]="burst.y">
        <svg viewBox="-32 -32 64 64" width="64" height="64">
          <circle class="burst-ring" r="11" fill="none" [attr.stroke]="burst.species.petalEdge" stroke-width="1.6" />
          @for (petal of petals; track petal.angle) {
            <g class="burst-petal" [style.--ba]="petal.angle + 'deg'" [style.--bd]="petal.dist + 'px'">
              <ellipse
                rx="2.7"
                ry="4.8"
                [attr.fill]="burst.species.petal"
                [attr.stroke]="burst.species.petalEdge"
                stroke-width="0.6"
              />
            </g>
          }
          @for (spark of sparks; track spark.angle) {
            <g class="burst-spark" [style.--ba]="spark.angle + 'deg'" [style.--bd]="spark.dist + 'px'">
              <circle r="1.7" [attr.fill]="burst.species.heart" />
            </g>
          }
        </svg>
      </div>
    }
  `,
})
export class BloomBurstHost {
  protected readonly service = inject(BloomBurstService);
  protected readonly petals = PETALS;
  protected readonly sparks = SPARKS;
}
