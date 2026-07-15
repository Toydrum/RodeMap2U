import { Component, Injectable, inject, signal } from '@angular/core';
import type { FlowerSpec, FruitSpec } from '../../features/forest/flora';
import { FruitGlyph } from '../../features/forest/fruit';
import { I18nService } from '../../core/i18n/i18n.service';

/**
 * «La lluvia de pétalos» + «la tarjetita» (0.0.89) — THE HARVEST LAYER of
 * celebration: both fire ONLY when a fruit actually mints (recordBloom
 * returned a row). The act layer (bloom-burst) keeps firing everywhere.
 * Per-layer equal dignity: every minted fruit gets the IDENTICAL sky and
 * card, forever — fixed petal table, no escalation, replace-don't-stack
 * (a rapid second bloom restarts, never densifies).
 *
 * The tarjetita is WEATHER, not a record: it exists only for ~2.4s after a
 * mint, is never listed, never re-viewable, never varies beyond species +
 * branch title, and NEVER carries an action (the toast slot keeps its own
 * jobs — different regions, different promises).
 *
 * Reduce-motion: NO full-screen anything; the card still appears (it is
 * information — which fruit you earned) with a plain fade.
 *
 * One service owns both so the mint-only law lives in one place. Self-
 * styled + host-rendered beside the toast (the 0.0.77 shared-component law).
 */

export interface HarvestCelebration {
  id: number;
  species: FlowerSpec;
  fruit: FruitSpec;
  /** The branch's words — the only label a fruit ever needs. */
  title: string;
}

/** Fixed forever — deterministic petal weather (left %, delay s, duration s,
 *  horizontal drift px, spin deg, size factor). Only species colors vary. */
const FALL_PETALS = [
  { left: 4, delay: 0, dur: 1.5, drift: 22, spin: 120, size: 1.0 },
  { left: 12, delay: 0.55, dur: 1.75, drift: -18, spin: -100, size: 1.25 },
  { left: 19, delay: 0.2, dur: 1.6, drift: 14, spin: 80, size: 0.85 },
  { left: 27, delay: 0.65, dur: 1.8, drift: -26, spin: -140, size: 1.1 },
  { left: 34, delay: 0.1, dur: 1.55, drift: 20, spin: 100, size: 0.9 },
  { left: 41, delay: 0.45, dur: 1.7, drift: -12, spin: -80, size: 1.2 },
  { left: 48, delay: 0.3, dur: 1.65, drift: 24, spin: 130, size: 1.0 },
  { left: 55, delay: 0, dur: 1.75, drift: -20, spin: -120, size: 0.8 },
  { left: 62, delay: 0.5, dur: 1.5, drift: 16, spin: 90, size: 1.15 },
  { left: 69, delay: 0.15, dur: 1.8, drift: -24, spin: -110, size: 0.95 },
  { left: 76, delay: 0.6, dur: 1.6, drift: 12, spin: 70, size: 1.25 },
  { left: 83, delay: 0.35, dur: 1.7, drift: -16, spin: -90, size: 0.85 },
  { left: 90, delay: 0.05, dur: 1.55, drift: 26, spin: 140, size: 1.05 },
  { left: 96, delay: 0.25, dur: 1.65, drift: -14, spin: -70, size: 0.9 },
];

@Injectable({ providedIn: 'root' })
export class HarvestSkyService {
  /** At most ONE live celebration — replace, never stack. */
  readonly current = signal<HarvestCelebration | null>(null);
  private seq = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;

  celebrate(species: FlowerSpec, fruit: FruitSpec, title: string): void {
    if (this.timer) clearTimeout(this.timer);
    this.current.set({ id: ++this.seq, species, fruit, title });
    this.timer = setTimeout(() => this.current.set(null), 2600);
  }

  dismissCard(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.current.set(null);
  }
}

@Component({
  selector: 'app-harvest-sky-host',
  imports: [FruitGlyph],
  styles: `
    .petal-fall {
      position: fixed;
      inset: 0;
      z-index: 690;
      pointer-events: none;
      overflow: hidden;
    }

    .fall-petal {
      position: absolute;
      top: 0;
      will-change: transform;
      animation: petal-fall linear both;
    }

    @keyframes petal-fall {
      0% {
        transform: translate3d(0, -6vh, 0) rotate(0deg);
        opacity: 0;
      }
      12% {
        opacity: 0.9;
      }
      85% {
        opacity: 0.85;
      }
      100% {
        transform: translate3d(var(--px), 110vh, 0) rotate(var(--pr));
        opacity: 0;
      }
    }

    .fruit-card-layer {
      position: fixed;
      inset: 0;
      z-index: 705;
      pointer-events: none;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      padding-top: calc(env(safe-area-inset-top) + 3.2rem);
    }

    .fruit-card {
      pointer-events: auto;
      display: flex;
      align-items: center;
      gap: 0.8rem;
      max-width: min(320px, calc(100vw - 2rem));
      padding: 0.7rem 1.1rem;
      background: var(--surface);
      border: 1.5px solid var(--card-border, var(--border-strong, rgba(0, 0, 0, 0.2)));
      border-radius: 16px;
      box-shadow: 0 6px 22px rgba(30, 30, 20, 0.16);
      cursor: pointer;
      animation: card-drop 0.4s cubic-bezier(0.34, 1.3, 0.64, 1) both;
    }

    @keyframes card-drop {
      0% {
        transform: translateY(-18px);
        opacity: 0;
      }
      70% {
        transform: translateY(3px);
        opacity: 1;
      }
      100% {
        transform: translateY(0);
      }
    }

    .card-fruit {
      flex: 0 0 auto;
    }

    .card-words {
      min-width: 0;
    }

    .card-headline {
      display: block;
      font-weight: 800;
      font-size: 1.02rem;
      line-height: 1.15;
    }

    .card-line {
      display: block;
      color: var(--text-dim);
      font-size: 0.82rem;
      margin-top: 0.15rem;
      overflow-wrap: anywhere;
    }

    /* Reduce-motion: no full-screen weather; the card (information) stays,
       with a plain fade. */
    :host-context(.reduce-motion) .petal-fall {
      display: none;
    }

    :host-context(.reduce-motion) .fruit-card {
      animation: card-fade 0.25s ease both;
    }

    @keyframes card-fade {
      from {
        opacity: 0;
      }
    }
  `,
  template: `
    @if (service.current(); as fest) {
      <div class="petal-fall" aria-hidden="true">
        @for (p of petals; track p.left) {
          <div
            class="fall-petal"
            [style.left.%]="p.left"
            [style.--px]="p.drift + 'px'"
            [style.--pr]="p.spin + 'deg'"
            [style.animation-delay.s]="p.delay"
            [style.animation-duration.s]="p.dur"
          >
            <svg viewBox="-8 -8 16 16" [attr.width]="16 * p.size" [attr.height]="16 * p.size">
              <ellipse
                rx="3.2"
                ry="5.6"
                [attr.fill]="fest.species.petal"
                [attr.stroke]="fest.species.petalEdge"
                stroke-width="0.6"
              />
            </svg>
          </div>
        }
      </div>
      <div class="fruit-card-layer">
        <div
          class="fruit-card"
          role="status"
          [style.border-color]="fest.fruit.skinEdge"
          (click)="service.dismissCard()"
        >
          <svg class="card-fruit" viewBox="-15 -16 30 30" width="56" height="56" aria-hidden="true">
            <g appFruit [fruit]="fest.fruit" [scale]="1.05" />
          </svg>
          <span class="card-words">
            <span class="card-headline">{{ i18n.t().cosecha.fruitCardTitles[fest.fruit.shape] }}</span>
            <span class="card-line">{{ i18n.fill(i18n.t().cosecha.fruitCardLine, { title: fest.title }) }}</span>
          </span>
        </div>
      </div>
    }
  `,
})
export class HarvestSkyHost {
  protected readonly service = inject(HarvestSkyService);
  protected readonly i18n = inject(I18nService);
  protected readonly petals = FALL_PETALS;
}
