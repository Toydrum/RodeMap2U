import { Component, computed, input } from '@angular/core';
import { Harvest, JarVessel } from '../../core/db/schema';
import { FruitGlyph } from './fruit';
import { PlacedFruit, glassFor, placeFruits } from './jar';

/**
 * «La promesa» (0.0.93) — a goal jar while it FILLS. Same hand-drawn glass as
 * the harvest/jam jars, but it holds the member fruits INSIDE its chosen vessel
 * (never a jam liquid — the tint is only computed at seal). Fullness reads as
 * fruits settling in the belly, never a fill line or a number (the one count
 * line lives on the jar's detail panel, nowhere else). Vessel = the size the
 * user picked (their own valuation of the premio); its silhouette is the same
 * three-vessel family as a sealed jam, so a full promise looks like a pot jam
 * at rest. Self-styled (the shared-component law).
 */
@Component({
  selector: 'app-promise-jar',
  imports: [FruitGlyph],
  styles: `
    :host {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
    }

    .jar-glass {
      fill: color-mix(in srgb, var(--accent-sky) 12%, transparent);
      stroke: color-mix(in srgb, var(--text) 55%, transparent);
      stroke-width: 1.6;
    }

    .jar-lip {
      fill: color-mix(in srgb, var(--rm-bark) 45%, var(--surface-2));
      stroke: color-mix(in srgb, var(--text) 45%, transparent);
      stroke-width: 1.2;
    }

    .jar-shine {
      fill: none;
      stroke: color-mix(in srgb, #ffffff 55%, transparent);
      stroke-width: 1.4;
      stroke-linecap: round;
    }

    [data-theme='terminal'] .jar-glass {
      fill: color-mix(in srgb, var(--primary) 8%, transparent);
      stroke: var(--border-strong);
    }

    [data-theme='terminal'] .jar-shine {
      stroke: color-mix(in srgb, var(--primary) 40%, transparent);
    }

    .jar-label {
      font-size: 0.66rem;
      font-weight: 700;
      color: var(--text-faint);
      white-space: nowrap;
    }
  `,
  template: `
    <svg
      viewBox="0 0 44 54"
      [attr.width]="44 * size()"
      [attr.height]="54 * size()"
      aria-hidden="true"
    >
      <rect class="jar-lip" x="10" y="4" width="24" height="5" rx="2.5" />
      @for (f of placed(); track f.key) {
        <g class="jar-fruit" [attr.transform]="'translate(' + f.x + ' ' + f.y + ') rotate(' + f.rot + ')'">
          <g appFruit [fruit]="f.spec" [scale]="0.5" />
        </g>
      }
      <path class="jar-glass" [attr.d]="glassD()" />
      <!-- Shine kept to the lower body so it fits all three vessels. -->
      <path class="jar-shine" d="M 12 28 C 11 33 11 38 12 42" />
      <path class="jar-shine" d="M 32.5 28 C 33.3 33 33.3 38 32.5 42" />
    </svg>
    @if (label()) {
      <span class="jar-label">{{ label() }}</span>
    }
  `,
})
export class PromiseJar {
  /** The fruits placed so far (any order — placeFruits sorts for paint depth). */
  readonly fruits = input.required<Harvest[]>();
  /** The vessel the user chose in the wizard. */
  readonly vessel = input.required<JarVessel>();
  readonly label = input<string>('');
  readonly size = input(1);

  protected readonly glassD = computed(() => glassFor(this.vessel()));
  protected readonly placed = computed<PlacedFruit[]>(() => placeFruits(this.fruits()));
}
