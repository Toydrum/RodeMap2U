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
          <path class="tail" d="M 7 22 Q 1 25 2 29 Q 8 28 11 24 Z"/>
          <ellipse class="body" cx="19" cy="21" rx="10" ry="8"/>
          <ellipse class="belly" cx="21" cy="24" rx="6" ry="4.4"/>
          <path class="wing" d="M 13 19 Q 20 15 25 20 Q 21 26 14 24 Z"/>
          <g class="head">
            <circle class="body" cx="28" cy="12" r="6"/>
            <path class="beak" d="M 33.5 11 L 38 12.4 L 33.5 14 Z"/>
            <circle class="eye" cx="30" cy="11" r="1.3"/>
            <path class="lid" d="M 28.6 11 q 1.4 -1.2 2.8 0"/>
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

    /* Logo palette via tokens — theme-aware, terminal included. */
    .body { fill: var(--accent-sage); }
    .tail,
    .wing { fill: var(--accent-moss); }
    .belly { fill: var(--surface-2); }
    .beak { fill: var(--status-branched); }
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
