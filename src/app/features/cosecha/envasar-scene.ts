import { Component, OnDestroy, OnInit, inject, input, output } from '@angular/core';
import { Preserve } from '../../core/db/schema';
import { JamJar } from '../forest/jam-jar';

/**
 * «El vertido» (0.0.100) — the jarring moment made visible, shared by both
 * rituals (mermelada-sheet beat 2 and hacer-mermelada-sheet). A small tilted
 * pot pours a stream of THE batch's own tint into the jar below while the jam
 * body rises inside the glass (JamJar [pour]); the cap drops and the bow ties
 * at the top (JamJar owns those beats). Purely decorative — never a gate: the
 * surrounding buttons stay live. `(done)` fires when the pour settles (~2.3s;
 * near-immediate under reduce-motion) so callers that WAIT for the ceremony
 * (hacer-mermelada) know when to seal. Self-styled (shared-component law).
 */
@Component({
  selector: 'app-envasar-scene',
  imports: [JamJar],
  template: `
    <div class="scene" aria-hidden="true">
      <svg class="pour-pot" viewBox="0 0 74 40" width="111" height="60">
        <g class="tilted">
          <path class="mini-pot-body" d="M 12 10 L 62 10 C 63 24 57 36 37 36 C 17 36 11 24 12 10 Z" />
          <ellipse class="mini-pot-mouth" cx="37" cy="10" rx="25" ry="4.4" />
          <ellipse class="mini-jam" cx="37" cy="10" rx="23" ry="3.6" [attr.fill]="preserve().tint" opacity="0.7" />
        </g>
      </svg>
      <svg class="stream" viewBox="0 0 10 34" width="10" height="34">
        <rect class="stream-rect" x="3.2" y="0" width="3.6" height="34" rx="1.8" [attr.fill]="preserve().tint" />
      </svg>
      <app-jam-jar [preserve]="preserve()" [size]="1.5" [label]="false" [pour]="true" />
    </div>
  `,
  styles: `
    .scene {
      display: flex;
      flex-direction: column;
      align-items: center;
      margin-bottom: 1rem;
    }

    .pour-pot {
      /* leans over the jar's mouth, offset right like a pouring hand */
      margin-right: -46px;
      margin-bottom: -6px;
    }

    .tilted {
      transform-box: view-box;
      transform-origin: 22px 30px;
      animation: pot-tilt 0.5s ease-out both;
    }

    .mini-pot-body {
      fill: color-mix(in srgb, var(--rm-bark) 55%, var(--surface-2));
      stroke: color-mix(in srgb, var(--text) 40%, transparent);
      stroke-width: 1.3;
    }

    .mini-pot-mouth {
      fill: color-mix(in srgb, var(--rm-bark) 30%, var(--surface));
      stroke: color-mix(in srgb, var(--text) 35%, transparent);
      stroke-width: 1.1;
    }

    @keyframes pot-tilt {
      from {
        transform: rotate(0deg);
      }
      to {
        transform: rotate(-30deg);
      }
    }

    .stream {
      margin: -4px 0 -2px -6px;
    }

    .stream-rect {
      transform-box: view-box;
      transform-origin: 5px 0;
      animation: stream-flow 1.5s ease-in both;
    }

    @keyframes stream-flow {
      0% {
        transform: scaleY(0);
        opacity: 0;
      }
      12% {
        transform: scaleY(1);
        opacity: 0.9;
      }
      80% {
        transform: scaleY(1);
        opacity: 0.9;
      }
      100% {
        transform: scaleY(0.05) translateY(620px);
        opacity: 0;
      }
    }

    :host-context(.reduce-motion) {
      .tilted {
        animation: none;
        transform: rotate(-30deg);
      }

      .stream-rect {
        animation: none;
        opacity: 0;
      }
    }
  `,
})
export class EnvasarScene implements OnInit, OnDestroy {
  readonly preserve = input.required<Preserve>();
  /** Fires when the pour settles (cap on, bow tied). */
  readonly done = output<void>();

  private timer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    const reduced = !!document.querySelector('.reduce-motion');
    this.timer = setTimeout(() => this.done.emit(), reduced ? 250 : 2400);
  }

  ngOnDestroy(): void {
    if (this.timer) clearTimeout(this.timer);
  }
}
