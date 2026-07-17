import { Component, input } from '@angular/core';

let uid = 0;

/** Dust motes along the arms — [x, y, kind, size]; positions precomputed on
 *  the same Archimedean arms the paths trace. */
const MOTES: ReadonlyArray<{ x: number; y: number; star: boolean; s: number; gold: boolean }> = [
  { x: -3.96, y: -0.63, star: false, s: 0.7, gold: true },
  { x: 6.5, y: -1.56, star: true, s: 1.0, gold: false },
  { x: -7.57, y: 5.5, star: false, s: 0.9, gold: false },
  { x: -3.62, y: -10.58, star: true, s: 0.8, gold: true },
  { x: 1.57, y: 4.83, star: false, s: 0.55, gold: false },
  { x: -5.04, y: -5.9, star: false, s: 0.75, gold: true },
  { x: 9.29, y: 4.74, star: true, s: 1.1, gold: false },
  { x: -6.29, y: 10.26, star: false, s: 0.6, gold: false },
];

/**
 * «La espiral» (0.0.104) — THE ritual symbol, shared everywhere a ritual
 * shows (tree canvas, almanaque shelf, meadow sign, tablita, node sheet).
 * A tiny nebula in the app's hand-drawn language (owner reference: a swirling
 * galaxy GIF): two Archimedean dust arms with a soft double-stroke (diffuse
 * without filters), a glowing core, and star-dust motes in two mystic tones
 * (lavender + soft gold). The WHOLE swirl turns slowly and continuously —
 * the reference's defining trait — while motes twinkle staggered. Base size
 * ≈ 12px radius at scale 1 (the FlowerGlyph convention); `animated` false
 * gives the still mark for tiny inline uses. Reduce-motion: everything still.
 */
@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'g[appSpiral]',
  template: `
    <svg:g [attr.transform]="'scale(' + scale() + ')'">
      <svg:defs>
        <svg:radialGradient [attr.id]="coreId">
          <svg:stop offset="0%" stop-color="#fff6df" stop-opacity="0.95" />
          <svg:stop offset="45%" [attr.stop-color]="tint()" stop-opacity="0.5" />
          <svg:stop offset="100%" [attr.stop-color]="tint()" stop-opacity="0" />
        </svg:radialGradient>
      </svg:defs>
      <svg:g class="swirl" [class.turning]="animated()">
        <!-- diffuse arms: wide faint tint halo under a finer, DEEPENED core
             stroke (species edges can be pale — mix toward text keeps the
             swirl legible at 13px in both themes) -->
        <svg:path class="arm-soft" [attr.d]="arm1" [attr.stroke]="tint()" />
        <svg:path class="arm-soft" [attr.d]="arm2" [attr.stroke]="tint()" />
        <svg:path class="arm" [attr.d]="arm1" [style.stroke]="deepTint()" />
        <svg:path class="arm" [attr.d]="arm2" [style.stroke]="deepTint()" />
        <!-- star dust: lavender + soft gold, twinkling staggered -->
        @for (m of motes; track $index) {
          @if (m.star) {
            <svg:path
              class="mote"
              [class.twinkling]="animated()"
              d="M 0 -2 L 0.55 -0.55 L 2 0 L 0.55 0.55 L 0 2 L -0.55 0.55 L -2 0 L -0.55 -0.55 Z"
              [attr.transform]="'translate(' + m.x + ' ' + m.y + ') scale(' + m.s + ')'"
              [attr.fill]="m.gold ? '#e8d29a' : '#c3b1ee'"
              [style.animation-delay]="$index * 0.45 + 's'"
            />
          } @else {
            <svg:circle
              class="mote"
              [class.twinkling]="animated()"
              [attr.cx]="m.x"
              [attr.cy]="m.y"
              [attr.r]="m.s"
              [attr.fill]="m.gold ? '#e8d29a' : '#c3b1ee'"
              [style.animation-delay]="$index * 0.45 + 's'"
            />
          }
        }
      </svg:g>
      <!-- the luminous core sits still — the eye of the swirl -->
      <svg:circle class="core-glow" r="5.2" [attr.fill]="'url(#' + coreId + ')'" />
      <svg:circle class="core" r="1.5" fill="#fff6df" [attr.stroke]="tint()" stroke-width="0.5" />
    </svg:g>
  `,
  styles: `
    .arm-soft {
      fill: none;
      stroke-width: 3.2;
      stroke-linecap: round;
      opacity: 0.3;
    }

    .arm {
      fill: none;
      stroke-width: 1.5;
      stroke-linecap: round;
      opacity: 0.9;
    }

    .swirl {
      transform-box: fill-box;
      transform-origin: center;
    }

    .swirl.turning {
      animation: spiral-turn 12s linear infinite;
    }

    @keyframes spiral-turn {
      to {
        transform: rotate(360deg);
      }
    }

    .mote {
      opacity: 0.75;
    }

    .mote.twinkling {
      animation: mote-twinkle 2.8s ease-in-out infinite;
    }

    @keyframes mote-twinkle {
      0%,
      100% {
        opacity: 0.3;
      }
      50% {
        opacity: 0.95;
      }
    }

    :host-context(.reduce-motion) {
      .swirl.turning,
      .mote.twinkling {
        animation: none;
      }

      .mote.twinkling {
        opacity: 0.5;
      }
    }
  `,
})
export class SpiralGlyph {
  protected readonly arm1 =
    'M 0.8 0 L 1.07 0.48 L 1.03 1.16 L 0.57 1.83 L -0.28 2.28 L -1.38 2.28 L -2.5 1.73 L -3.36 0.61 L -3.67 -0.91 L -3.27 -2.56 L -2.11 -4.01 L -0.3 -4.89 L 1.87 -4.93 L 4 -4 L 5.63 -2.14 L 6.38 0.39 L 5.99 3.15 L 4.4 5.62 L 1.8 7.3 L -1.42 7.76 L -4.69 6.8 L -7.39 4.47 L -8.94 1.09 L -8.96 -2.79 L -7.3 -6.47 L -4.16 -9.23 L 0 -10.5';
  protected readonly arm2 =
    'M -0.8 0 L -1.07 -0.48 L -1.03 -1.16 L -0.57 -1.83 L 0.28 -2.28 L 1.38 -2.28 L 2.5 -1.73 L 3.36 -0.61 L 3.67 0.91 L 3.27 2.56 L 2.11 4.01 L 0.3 4.89 L -1.87 4.93 L -4 4 L -5.63 2.14 L -6.38 -0.39 L -5.99 -3.15 L -4.4 -5.62 L -1.8 -7.3 L 1.42 -7.76 L 4.69 -6.8 L 7.39 -4.47 L 8.94 -1.09 L 8.96 2.79 L 7.3 6.47 L 4.16 9.23 L 0 10.5';
  protected readonly motes = MOTES;
  protected readonly coreId = `spiral-core-${uid++}`;

  /** The swirl's own color — species petalEdge on the canvas, accent-ish elsewhere. */
  readonly tint = input('#a98fd6');
  readonly scale = input(1);
  /** false = the still mark for tiny inline uses (sign, tablita). */
  readonly animated = input(true);

  /** The fine stroke leans toward the theme's text so pale species stay legible. */
  protected deepTint(): string {
    return `color-mix(in srgb, ${this.tint()} 62%, var(--text))`;
  }
}
