import { Component, computed, input } from '@angular/core';
import { Harvest } from '../../core/db/schema';
import { fruitFor } from './flora';
import { FruitGlyph } from './fruit';
import { hash } from './tree-layout';

/** THE glass geometry — one law shared by the fresh jar and every jam jar
 *  (viewBox 0 0 44 54; interior x 8–36, y 9–51). */
export const JAR_GLASS_D =
  'M 12 9 C 10 12 8 14 8 18 L 8 44 C 8 49 12 51 22 51 C 32 51 36 49 36 44 L 36 18 C 36 14 34 12 32 9 Z';

/**
 * «El frasco» (0.0.88) — the harvest jar: hand-drawn glass holding the
 * fruits of bloomed branches. Fullness reads as CLUSTER DENSITY, never as
 * a fill line or a number (endowed progress with the numerator only). The
 * 12 most recent fruits render at id-stable hash positions — arrivals and
 * removals only ever move their own fruit, nothing reshuffles (rule 4).
 * Glass paints AFTER the fruits so its shine strokes sit over them —
 * contents visibly INSIDE. Self-styled (the 0.0.77 shared-component law);
 * used small on the meadow and large as the cosecha page hero.
 */
@Component({
  selector: 'app-meadow-jar',
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
      <path class="jar-glass" [attr.d]="glassD" />
      <path class="jar-shine" d="M 12 16 C 11 24 11 34 12 42" />
      <path class="jar-shine" d="M 32.5 18 C 33.3 26 33.3 32 32.5 40" />
    </svg>
    @if (label()) {
      <span class="jar-label">{{ label() }}</span>
    }
  `,
})
export class MeadowJar {
  protected readonly glassD = JAR_GLASS_D;
  /** Newest-first harvests (HarvestsRepo.newestFirst). */
  readonly fruits = input.required<Harvest[]>();
  /** Optional caption under the glass. */
  readonly label = input<string>('');
  /** Render scale — 1 on the meadow, ~2 as the page hero. */
  readonly size = input(1);

  /** 12 most recent at id-stable positions, painted lower-in-jar last. */
  protected readonly placed = computed(() =>
    this.fruits()
      .slice(0, 12)
      .map((h) => ({
        key: h.id,
        x: 14 + (hash(h.nodeId + ':jx') % 17),
        y: 30 + (hash(h.nodeId + ':jy') % 15),
        rot: -14 + (hash(h.nodeId + ':jr') % 29),
        spec: fruitFor(h.accent, h.treeId),
      }))
      .sort((a, b) => a.y - b.y),
  );
}
