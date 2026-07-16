import { Component, computed, input } from '@angular/core';
import { FruitSpec } from '../forest/flora';
import { FruitGlyph } from '../forest/fruit';

export interface PotFruit {
  key: string;
  x: number;
  y: number;
  rot: number;
  spec: FruitSpec;
}

/**
 * «La olla al fuego» (0.0.97, redrawn 0.0.101) — the shared cooking pot for
 * both rituals. A copper-warm pot sits over a real log fire; the jam fills the
 * mouth as a rich, OPAQUE surface in the batch's own tint; the fruits float IN
 * the jam (clipped to the mouth, gently bobbing); a proper wooden spoon rests
 * dipped in, and on «Remover» it sweeps arcs while the surface swirls and the
 * simmer quickens. Steam curls up; flames flicker. Reduce-motion: everything
 * still. Class names (.pot-fruit/.spoon/.bubble/.jam-swirl/.fruit-swirl and
 * the .pot.stirring hook) are verify-critical — keep them. Self-styled.
 */
@Component({
  selector: 'app-cooking-pot',
  imports: [FruitGlyph],
  template: `
    <svg class="pot on-fire" [class.stirring]="stirring()" viewBox="0 0 120 100" width="200" height="167" aria-hidden="true">
      <defs>
        <clipPath id="pot-mouth-clip">
          <ellipse cx="60" cy="30" rx="39" ry="6.6" />
        </clipPath>
      </defs>

      <!-- steam curling up from the simmer -->
      <g class="steam" aria-hidden="true">
        <path class="wisp w1" d="M 44 19 C 40 13 47 9 43 2" />
        <path class="wisp w2" d="M 61 16 C 65 10 58 6 62 -1" />
        <path class="wisp w3" d="M 77 19 C 73 13 80 9 76 3" />
      </g>

      <!-- the hearth: crossed logs + layered flames, BEHIND the pot -->
      <g class="hearth">
        <g class="flames">
          <path class="flame-side f1" d="M 44 90 C 39 85 40 79 44 73 C 48 79 49 85 44 90 Z" />
          <path class="flame-side f2" d="M 76 90 C 71 85 72 79 76 73 C 80 79 81 85 76 90 Z" />
          <path class="flame-big" d="M 60 92 C 50 86 52 74 60 63 C 68 74 70 86 60 92 Z" />
          <path class="flame-core" d="M 60 90 C 55 86 56 79 60 72 C 64 79 65 86 60 90 Z" />
        </g>
        <rect class="log" x="36" y="90" width="48" height="5.5" rx="2.75" transform="rotate(-4 60 92)" />
        <rect class="log log-2" x="40" y="92.5" width="42" height="5.5" rx="2.75" transform="rotate(3 60 95)" />
      </g>

      <!-- the pot: warm copper body, sheen, sturdy ears, thick rim -->
      <path class="pot-ear" d="M 15 33 C 6 33 5 43 14 44" />
      <path class="pot-ear" d="M 105 33 C 114 33 115 43 106 44" />
      <path class="pot-body" d="M 17 30 L 103 30 C 105 52 95 74 60 74 C 25 74 15 52 17 30 Z" />
      <path class="pot-band" d="M 18.5 36 L 101.5 36 C 101 40 100 44 98.4 48 L 21.6 48 C 20 44 19 40 18.5 36 Z" />
      <path class="pot-sheen" d="M 26 40 C 26 52 31 62 41 67" />
      <ellipse class="pot-rim" cx="60" cy="30" rx="44" ry="8.2" />
      <ellipse class="pot-interior" cx="60" cy="30" rx="39" ry="6.6" />

      @if (hasFruits()) {
        <!-- the jam: a rich, opaque surface in the batch's own tint -->
        <ellipse class="jam-full" cx="60" cy="30" rx="39" ry="6.6" [attr.fill]="tint().tint" />
        <ellipse class="jam-glow" cx="55" cy="29" rx="26" ry="3.9" />
        <!-- fruits float IN the jam (clipped to the mouth), bobbing gently -->
        <g clip-path="url(#pot-mouth-clip)">
          <g class="fruit-swirl">
            @for (f of placed(); track f.key; let i = $index) {
              <g class="pot-fruit" [style.animation-delay]="(i * 0.9) + 's'">
                <g [attr.transform]="'translate(' + f.x + ' ' + f.y + ') rotate(' + f.rot + ')'">
                  <g appFruit [fruit]="f.spec" [scale]="0.62" />
                </g>
              </g>
            }
          </g>
        </g>
        <ellipse class="jam-swirl" cx="60" cy="30" rx="27" ry="4" fill="none" [attr.stroke]="tint().tintEdge" stroke-width="1.5" opacity="0.55" />
        <!-- the simmer: bubbles surfacing along the jam -->
        <g class="bubbles">
          <circle class="bubble b1" cx="46" cy="29.5" r="1.7" [attr.fill]="tint().tintEdge" />
          <circle class="bubble b2" cx="63" cy="31" r="2.1" [attr.fill]="tint().tintEdge" />
          <circle class="bubble b3" cx="76" cy="29" r="1.5" [attr.fill]="tint().tintEdge" />
        </g>
        <!-- a proper wooden spoon, dipped into the jam -->
        <g class="spoon">
          <path class="spoon-handle-dark" d="M 86 3 L 64.5 31" />
          <path class="spoon-handle" d="M 85.4 3.6 L 64.8 30.4" />
          <ellipse class="spoon-bowl" cx="62.5" cy="32.6" rx="7" ry="4.4" transform="rotate(-38 62.5 32.6)" />
          <ellipse class="spoon-bowl-in" cx="61.8" cy="32.2" rx="4.6" ry="2.7" transform="rotate(-38 61.8 32.2)" />
          <ellipse class="spoon-dip" cx="62" cy="35.4" rx="8.4" ry="2.6" [attr.fill]="tint().tint" />
        </g>
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-block;
      line-height: 0;
    }

    /* ── the pot: warm copper, hand-drawn strokes like the jars ── */
    .pot-body {
      fill: color-mix(in srgb, #a26847 62%, var(--surface-2));
      stroke: color-mix(in srgb, #5f3c28 70%, var(--text));
      stroke-width: 1.6;
    }

    .pot-band {
      fill: color-mix(in srgb, #b97f56 55%, var(--surface-2));
      opacity: 0.55;
    }

    .pot-sheen {
      fill: none;
      stroke: color-mix(in srgb, #ffffff 45%, transparent);
      stroke-width: 2.6;
      stroke-linecap: round;
      opacity: 0.5;
    }

    .pot-rim {
      fill: color-mix(in srgb, #8a5638 68%, var(--surface-2));
      stroke: color-mix(in srgb, #5f3c28 70%, var(--text));
      stroke-width: 1.6;
    }

    .pot-interior {
      fill: color-mix(in srgb, #3c2a1e 80%, var(--surface-2));
    }

    .pot-ear {
      fill: none;
      stroke: color-mix(in srgb, #5f3c28 72%, var(--text));
      stroke-width: 4.6;
      stroke-linecap: round;
    }

    /* ── the jam ── */
    .jam-glow {
      fill: #ffffff;
      opacity: 0.16;
    }

    .pot-fruit {
      animation: fruit-bob 3.2s ease-in-out infinite;
    }

    @keyframes fruit-bob {
      0%,
      100% {
        transform: translateY(0);
      }
      50% {
        transform: translateY(-1.6px);
      }
    }

    /* ── the fire: layered flames + logs ── */
    .log {
      fill: color-mix(in srgb, #6d4526 72%, var(--surface-2));
      stroke: color-mix(in srgb, #4a2d18 70%, var(--text));
      stroke-width: 1.1;
    }

    .log-2 {
      fill: color-mix(in srgb, #7d5230 72%, var(--surface-2));
    }

    .flames path {
      transform-box: fill-box;
      transform-origin: 50% 100%;
    }

    .flame-big {
      fill: color-mix(in srgb, #e8964f 82%, var(--surface));
      animation: flame-lick 1.9s ease-in-out infinite;
    }

    .flame-core {
      fill: color-mix(in srgb, #f4c25e 88%, var(--surface));
      animation: flame-lick 1.9s ease-in-out infinite 0.4s;
    }

    .flame-side {
      fill: color-mix(in srgb, #dd8348 72%, var(--surface));
      animation: flame-lick 2.4s ease-in-out infinite;
    }

    .flame-side.f2 {
      animation-delay: 1.1s;
    }

    @keyframes flame-lick {
      0%,
      100% {
        transform: scaleY(1);
        opacity: 0.9;
      }
      50% {
        transform: scaleY(1.12) scaleX(0.94);
        opacity: 1;
      }
    }

    /* ── the spoon: real wood, two-tone, dipped in ── */
    .spoon-handle-dark {
      fill: none;
      stroke: color-mix(in srgb, #6d4526 80%, var(--text));
      stroke-width: 5.4;
      stroke-linecap: round;
    }

    .spoon-handle {
      fill: none;
      stroke: color-mix(in srgb, #a8744a 85%, var(--surface));
      stroke-width: 3;
      stroke-linecap: round;
    }

    .spoon-bowl {
      fill: color-mix(in srgb, #a8744a 85%, var(--surface));
      stroke: color-mix(in srgb, #6d4526 80%, var(--text));
      stroke-width: 1.3;
    }

    .spoon-bowl-in {
      fill: color-mix(in srgb, #8a5a36 80%, var(--surface-2));
      opacity: 0.8;
    }

    .spoon-dip {
      opacity: 0.85;
    }

    /* ── steam ── */
    .wisp {
      fill: none;
      stroke: color-mix(in srgb, var(--text) 30%, transparent);
      stroke-width: 2.2;
      stroke-linecap: round;
      animation: wisp-rise 3.4s ease-in-out infinite;
    }

    .wisp.w2 {
      animation-delay: 1.2s;
    }

    .wisp.w3 {
      animation-delay: 2.3s;
    }

    @keyframes wisp-rise {
      0% {
        transform: translateY(5px);
        opacity: 0;
      }
      40% {
        opacity: 0.55;
      }
      100% {
        transform: translateY(-8px);
        opacity: 0;
      }
    }

    /* ── the simmer ── */
    .bubble {
      transform-box: fill-box;
      transform-origin: center;
      opacity: 0;
      animation: simmer 2.6s ease-in-out infinite;
    }

    .bubble.b2 {
      animation-duration: 3.1s;
      animation-delay: 0.8s;
    }

    .bubble.b3 {
      animation-duration: 2.8s;
      animation-delay: 1.6s;
    }

    @keyframes simmer {
      0%,
      100% {
        transform: scale(0.3);
        opacity: 0;
      }
      45% {
        transform: scale(1);
        opacity: 0.55;
      }
      70% {
        transform: scale(1.25);
        opacity: 0;
      }
    }

    /* ── the stir: the spoon pivots at its bowl and sweeps arcs; the surface
       swirls; the fruits jostle; the simmer quickens ── */
    .spoon {
      transform-box: view-box;
      transform-origin: 62px 32px;
      animation: spoon-sway 4.5s ease-in-out infinite;
    }

    @keyframes spoon-sway {
      0%,
      100% {
        transform: rotate(-2deg);
      }
      50% {
        transform: rotate(2deg);
      }
    }

    .fruit-swirl {
      transform-box: view-box;
      transform-origin: 60px 30px;
    }

    .jam-swirl {
      transform-box: view-box;
      transform-origin: 60px 30px;
    }

    .pot.stirring .spoon {
      animation: spoon-stir 2.4s ease-in-out;
    }

    @keyframes spoon-stir {
      0% { transform: rotate(0deg); }
      14% { transform: rotate(-26deg); }
      38% { transform: rotate(24deg); }
      62% { transform: rotate(-22deg); }
      86% { transform: rotate(18deg); }
      100% { transform: rotate(0deg); }
    }

    .pot.stirring .fruit-swirl {
      animation: fruit-jostle 2.4s ease-in-out;
    }

    @keyframes fruit-jostle {
      0% { transform: rotate(0deg); }
      20% { transform: rotate(5deg); }
      45% { transform: rotate(-4deg); }
      70% { transform: rotate(4deg); }
      100% { transform: rotate(0deg); }
    }

    .pot.stirring .jam-swirl {
      animation: swirl 2.4s ease-in-out;
    }

    @keyframes swirl {
      0% { transform: rotate(0deg); }
      25% { transform: rotate(26deg) scale(0.92); }
      55% { transform: rotate(-20deg) scale(0.95); }
      80% { transform: rotate(20deg) scale(0.93); }
      100% { transform: rotate(0deg); }
    }

    .pot.stirring .bubble {
      animation-duration: 1.3s;
    }

    :host-context(.reduce-motion) {
      .pot-fruit,
      .spoon,
      .fruit-swirl,
      .jam-swirl,
      .bubble,
      .wisp,
      .flames path {
        animation: none;
      }

      .bubble {
        display: none;
      }

      .wisp {
        opacity: 0.4;
      }
    }
  `,
})
export class CookingPot {
  readonly fruits = input.required<PotFruit[]>();
  readonly tint = input.required<{ tint: string; tintEdge: string }>();
  readonly stirring = input(false);

  protected readonly hasFruits = computed(() => this.fruits().length > 0);

  /** The sheets hand us belly-scatter coordinates from the old art; remap them
   *  deterministically onto the jam SURFACE band so fruits float in the jam. */
  protected readonly placed = computed(() =>
    this.fruits().map((f) => ({
      ...f,
      x: 30 + (Math.round(f.x * 7) % 60),
      y: 26 + (Math.round(f.y * 3) % 7),
      rot: f.rot / 2,
    })),
  );
}
