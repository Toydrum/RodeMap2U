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
 * «La olla al fuego» (0.0.97) — the shared cooking pot, one source of truth for
 * both the jam ritual (mermelada-sheet beat 1) and «Hacer mermelada» of a full
 * goal jar (hacer-mermelada-sheet). It simmers on the fire with the batch's
 * fruits inside; a WOODEN SPOON rests in the jam and, on «Remover», sweeps a
 * stir around the jam's center (the bowl orbits) while the swirl spins and
 * bubbles rise — replaces the old «solo un círculo». Bubbles simmer of their
 * own accord so it reads as cooking. Reduce-motion: everything still, spoon
 * resting. Self-styled (shared-component law). Viewbox 0 0 120 92.
 */
@Component({
  selector: 'app-cooking-pot',
  imports: [FruitGlyph],
  template: `
    <svg class="pot on-fire" [class.stirring]="stirring()" viewBox="0 0 120 92" width="200" height="153" aria-hidden="true">
      <g class="steam" aria-hidden="true">
        <path class="wisp w1" d="M 48 14 C 44 8 52 4 48 -2" />
        <path class="wisp w2" d="M 72 12 C 76 6 68 2 72 -4" />
      </g>
      <path class="pot-body" d="M 18 26 L 102 26 C 104 50 94 70 60 70 C 26 70 16 50 18 26 Z" />
      <ellipse class="pot-mouth" cx="60" cy="26" rx="42" ry="7" />
      @if (hasFruits()) {
        <ellipse class="jam-surface" cx="60" cy="26" rx="40" ry="6.4" [attr.fill]="tint().tint" opacity="0.5" />
        <ellipse class="jam-swirl" cx="60" cy="26" rx="26" ry="4" fill="none" [attr.stroke]="tint().tintEdge" stroke-width="1.4" opacity="0.55" />
        <!-- bubbles rising from the simmer -->
        <g class="bubbles">
          <circle class="bubble b1" cx="48" cy="26" r="1.9" [attr.fill]="tint().tint" />
          <circle class="bubble b2" cx="62" cy="26" r="2.4" [attr.fill]="tint().tint" />
          <circle class="bubble b3" cx="74" cy="26" r="1.6" [attr.fill]="tint().tint" />
        </g>
      }
      @for (f of fruits(); track f.key) {
        <g class="pot-fruit" [attr.transform]="'translate(' + f.x + ' ' + f.y + ') rotate(' + f.rot + ')'">
          <g appFruit [fruit]="f.spec" [scale]="0.8" />
        </g>
      }
      @if (hasFruits()) {
        <!-- the wooden spoon: handle from upper-right, bowl dipped in the jam -->
        <g class="spoon">
          <path class="spoon-handle" d="M 82 2 L 60 30" />
          <ellipse class="spoon-bowl" cx="59" cy="31" rx="5.6" ry="3.4" transform="rotate(-40 59 31)" />
        </g>
      }
      <path class="pot-handle" d="M 14 30 Q 2 32 8 42" />
      <path class="pot-handle" d="M 106 30 Q 118 32 112 42" />
      <g class="flame" aria-hidden="true">
        <path d="M 52 82 Q 56 74 60 82 Q 64 74 68 82" />
      </g>
    </svg>
  `,
  styles: `
    :host {
      display: inline-block;
      line-height: 0;
    }

    .pot-body {
      fill: color-mix(in srgb, var(--rm-bark) 55%, var(--surface-2));
      stroke: color-mix(in srgb, var(--text) 40%, transparent);
      stroke-width: 1.4;
    }

    .pot-mouth {
      fill: color-mix(in srgb, var(--rm-bark) 30%, var(--surface));
      stroke: color-mix(in srgb, var(--text) 35%, transparent);
      stroke-width: 1.2;
    }

    .pot-handle {
      fill: none;
      stroke: color-mix(in srgb, var(--text) 45%, transparent);
      stroke-width: 2.2;
      stroke-linecap: round;
    }

    .pot-fruit {
      animation: pot-drop 0.45s cubic-bezier(0.34, 1.3, 0.64, 1) both;
    }

    @keyframes pot-drop {
      from {
        transform: translate(var(--tx, 0), -26px) scale(0.5);
        opacity: 0;
      }
    }

    /* the wooden spoon */
    .spoon {
      transform-box: view-box;
      transform-origin: 60px 26px;
      animation: spoon-sway 4.5s ease-in-out infinite;
    }

    .spoon-handle {
      fill: none;
      stroke: color-mix(in srgb, var(--rm-bark) 78%, var(--text));
      stroke-width: 3.4;
      stroke-linecap: round;
    }

    .spoon-bowl {
      fill: color-mix(in srgb, var(--rm-bark) 62%, var(--surface));
      stroke: color-mix(in srgb, var(--rm-bark) 85%, var(--text));
      stroke-width: 1;
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

    /* the boil */
    .bubble {
      transform-box: view-box;
      transform-origin: center;
      opacity: 0;
      animation: simmer 2.4s ease-in infinite;
    }

    .bubble.b2 {
      animation-duration: 2.9s;
      animation-delay: 0.7s;
    }

    .bubble.b3 {
      animation-duration: 2.6s;
      animation-delay: 1.3s;
    }

    @keyframes simmer {
      0% {
        transform: translateY(0) scale(0.5);
        opacity: 0;
      }
      25% {
        opacity: 0.55;
      }
      100% {
        transform: translateY(-11px) scale(1);
        opacity: 0;
      }
    }

    /* the stir — the spoon sweeps around the jam center, bowl orbiting */
    .pot.stirring .spoon {
      animation: stir 1.1s ease-in-out;
    }

    @keyframes stir {
      0% {
        transform: rotate(0deg);
      }
      25% {
        transform: rotate(-24deg);
      }
      60% {
        transform: rotate(16deg);
      }
      85% {
        transform: rotate(-6deg);
      }
      100% {
        transform: rotate(0deg);
      }
    }

    .pot.stirring .jam-swirl {
      animation: swirl 1.1s ease-in-out;
    }

    @keyframes swirl {
      0% {
        transform: rotate(0deg);
      }
      50% {
        transform: rotate(20deg) scale(0.92);
      }
      100% {
        transform: rotate(0deg);
      }
    }

    .jam-swirl {
      transform-origin: 60px 26px;
      transform-box: view-box;
    }

    /* fire + steam */
    .flame path {
      fill: none;
      stroke: color-mix(in srgb, #e8964f 75%, var(--surface));
      stroke-width: 2.4;
      stroke-linecap: round;
      animation: flame-breathe 2.6s ease-in-out infinite;
    }

    @keyframes flame-breathe {
      0%,
      100% {
        opacity: 0.55;
      }
      50% {
        opacity: 0.95;
      }
    }

    .wisp {
      fill: none;
      stroke: color-mix(in srgb, var(--text) 25%, transparent);
      stroke-width: 1.6;
      stroke-linecap: round;
      animation: wisp-rise 3.4s ease-in-out infinite;
    }

    .wisp.w2 {
      animation-delay: 1.7s;
    }

    @keyframes wisp-rise {
      0% {
        transform: translateY(4px);
        opacity: 0;
      }
      40% {
        opacity: 0.6;
      }
      100% {
        transform: translateY(-7px);
        opacity: 0;
      }
    }

    :host-context(.reduce-motion) {
      .pot-fruit,
      .spoon,
      .bubble {
        animation: none;
      }
      .bubble {
        display: none;
      }
      .flame path,
      .wisp {
        animation: none;
        opacity: 0.5;
      }
    }
  `,
})
export class CookingPot {
  readonly fruits = input.required<PotFruit[]>();
  readonly tint = input.required<{ tint: string; tintEdge: string }>();
  readonly stirring = input(false);

  protected readonly hasFruits = computed(() => this.fruits().length > 0);
}
