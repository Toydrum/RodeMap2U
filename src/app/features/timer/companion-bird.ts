import { Component, inject, input } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { hash } from '../forest/tree-layout';

export type BirdState = 'working' | 'resting' | 'bloomed' | 'approaching';

/** Transition-bridge window before the planted time completes. */
export const BRIDGE_MS = 2 * 60_000;

/** Pure state resolver shared by timer + ahora (each wraps it in a computed). */
export function birdStateFrom(paused: boolean, overtime: boolean, remainingMs: number): BirdState {
  if (paused) return 'resting';
  if (overtime) return 'bloomed';
  return remainingMs <= BRIDGE_MS ? 'approaching' : 'working';
}

/**
 * Single-player body doubling: a little bird that perches while a focus
 * session runs. It measures nothing, hurries nothing, makes no sound —
 * presence without evaluation. All motion is CSS-only with deterministic
 * phase (hash of the session id), poses are class swaps, and under
 * .reduce-motion the bird stays present but perfectly still.
 */
@Component({
  selector: 'app-companion-bird',
  host: { '[class]': '"state-" + state()' },
  template: `
    <svg viewBox="0 0 40 34" class="bird" role="img" [attr.aria-label]="i18n.t().ahora.birdAria"
         [style.--preen-delay.ms]="preenDelay()">
      <g class="flip">
        <g class="breathe">
          <!-- A parakeet after the owner's reference: long tapered tail,
               layered wing, cream belly, hooked coral beak, cheek spot. -->
          <path class="tail" d="M 12 23 Q 5 27 1.5 33 Q 7 32 11 27.5 Q 12.6 25.6 13.4 24.4 Z"/>
          <ellipse class="body" cx="18.5" cy="20" rx="8.6" ry="9.4"/>
          <ellipse class="belly" cx="21" cy="23.4" rx="5.4" ry="5.6"/>
          <path class="wing" d="M 11 15.5 Q 19 11.5 24 17.5 Q 22.5 24.5 13.5 24 Q 9.8 20 11 15.5 Z"/>
          <path class="wing-tip" d="M 12.4 21.6 Q 17.5 24.2 22.8 20.6 Q 20.5 26.4 12.8 24.6 Z"/>
          <g class="head">
            <circle class="body" cx="27" cy="10" r="6.5"/>
            <path class="beak" d="M 32.6 7.8 Q 38.4 8.2 37.2 12.4 Q 36.3 15 33.2 14 Q 35.4 11.4 32.6 9.6 Z"/>
            <circle class="cheek" cx="29.6" cy="12.6" r="1.9"/>
            <circle class="eye" cx="28.4" cy="9.2" r="1.3"/>
            <path class="lid" d="M 27 9.2 q 1.4 -1.2 2.8 0"/>
          </g>
        </g>
        <path class="legs" d="M 16 29 v 3 M 22 29 v 3"/>
      </g>
    </svg>
  `,
  styles: `
    :host {
      display: inline-block;
      width: 38px;
    }

    .bird {
      display: block;
      overflow: visible;
    }

    /* Parakeet palette via tokens — theme-aware, terminal included. The
       coral beak/cheek is a SPECIES color (rose+clay mix), not an urgency
       signal — the never-red doctrine governs rings and statuses. */
    .body { fill: var(--accent-sage); }
    .wing { fill: var(--accent-moss); }
    .wing-tip { fill: color-mix(in srgb, var(--accent-pine) 70%, var(--accent-moss)); }
    .tail { fill: color-mix(in srgb, var(--accent-moss) 60%, var(--accent-pine)); }
    .belly { fill: color-mix(in srgb, var(--accent-sand) 55%, var(--surface-2)); }
    .beak,
    .cheek { fill: color-mix(in srgb, var(--accent-rose) 72%, var(--accent-clay)); }
    .cheek { opacity: 0.85; }
    .legs { fill: none; stroke: var(--status-branched); stroke-width: 1.6; stroke-linecap: round; }
    .eye { fill: var(--text); }
    .lid { display: none; fill: none; stroke: var(--accent-moss); stroke-width: 1.4; stroke-linecap: round; }

    .flip {
      transition: transform 0.6s ease;
      transform-origin: 50% 60%;
    }

    /* Non-harmonic periods (4s / 6s / 47s) never sync into a pattern;
       the per-session phase comes from a negative delay. */
    .breathe {
      transform-origin: 50% 100%;
      animation: bird-breathe 4s ease-in-out infinite;
    }

    .head {
      transform-origin: 26px 16px;
      transition: transform 0.5s ease;
      animation: bird-preen 47s ease-in-out infinite;
      animation-delay: var(--preen-delay, 0ms);
    }

    .eye {
      animation: bird-blink 6s step-end infinite;
    }

    /* Poses — class swaps, honest under reduce-motion. */
    :host(.state-approaching) .flip {
      transform: scaleX(-1);
    }

    :host(.state-resting) .head {
      transform: rotate(-22deg) translate(-1px, 2px);
      animation: none;
    }
    :host(.state-resting) .eye { display: none; }
    :host(.state-resting) .lid { display: block; }

    :host(.state-bloomed) .breathe {
      animation: bird-breathe 4s ease-in-out infinite, bird-hop 0.8s ease 1;
    }

    @keyframes bird-breathe {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.02); }
    }
    @keyframes bird-blink {
      0%, 91%, 96%, 100% { opacity: 1; }
      92%, 95% { opacity: 0; }
    }
    @keyframes bird-preen {
      0%, 96%, 100% { transform: none; }
      97%, 99% { transform: rotate(14deg); }
    }
    @keyframes bird-hop {
      0%, 100% { transform: translateY(0); }
      40% { transform: translateY(-4px); }
    }

    /* Belt-and-braces on top of the global backstop: still, but present. */
    :host-context(.reduce-motion) .breathe,
    :host-context(.reduce-motion) .head,
    :host-context(.reduce-motion) .eye {
      animation: none !important;
    }
  `,
})
export class CompanionBird {
  protected readonly i18n = inject(I18nService);
  readonly state = input<BirdState>('working');
  /** Stable id (the session id) — deterministic animation phase. */
  readonly seed = input<string>('');

  protected preenDelay(): number {
    return -(hash(this.seed() + ':preen') % 47_000);
  }
}
