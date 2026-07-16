import { Component, computed, input } from '@angular/core';
import { Preserve } from '../../core/db/schema';

/**
 * «El elixir de despedida» (0.0.95) — a distilled vial commemorating a closed
 * chapter (an archived, fruited tree). A narrow flask, distinct from the jam
 * jars: cork-stoppered and full of the tree's distilled tint while it waits;
 * once the brindis is drunk (openedAt) the cork rests aside and the vial
 * drains to a faint dreg — enjoyed, kept forever as a keepsake. Same 0 0 44 54
 * viewBox as the jars so it sits evenly on the shelves. Self-styled.
 */
@Component({
  selector: 'app-elixir-vial',
  styles: `
    :host {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
    }

    .vial-glass {
      fill: color-mix(in srgb, var(--accent-sky) 10%, transparent);
      stroke: color-mix(in srgb, var(--text) 55%, transparent);
      stroke-width: 1.6;
    }

    .vial-cork {
      fill: color-mix(in srgb, var(--rm-bark) 55%, var(--surface-2));
      stroke: color-mix(in srgb, var(--text) 45%, transparent);
      stroke-width: 1;
    }

    .vial-shine {
      fill: none;
      stroke: color-mix(in srgb, #ffffff 55%, transparent);
      stroke-width: 1.3;
      stroke-linecap: round;
    }

    [data-theme='terminal'] .vial-glass {
      fill: color-mix(in srgb, var(--primary) 8%, transparent);
      stroke: var(--border-strong);
    }

    .vial-label {
      font-size: 0.66rem;
      font-weight: 700;
      color: var(--text-faint);
      white-space: nowrap;
    }
  `,
  template: `
    <svg viewBox="0 0 44 54" [attr.width]="44 * size()" [attr.height]="54 * size()" aria-hidden="true">
      <defs>
        <clipPath [attr.id]="clipId">
          <path [attr.d]="BODY_D" />
        </clipPath>
      </defs>
      <g [attr.clip-path]="'url(#' + clipId + ')'">
        @if (!opened()) {
          <rect x="10" y="16" width="24" height="38" [attr.fill]="preserve().tint" opacity="0.82" />
          <ellipse cx="22" cy="18" rx="12" ry="2.4" [attr.fill]="preserve().tintEdge" opacity="0.6" />
        } @else {
          <!-- brindado: a faint dreg at the bottom — savored, kept. -->
          <rect x="10" y="48" width="24" height="6" [attr.fill]="preserve().tint" opacity="0.3" />
        }
      </g>
      <path class="vial-glass" [attr.d]="BODY_D" />
      <path class="vial-shine" d="M 16 22 C 15 30 15 40 16 48" />
      @if (!opened()) {
        <rect class="vial-cork" x="18" y="3" width="8" height="7" rx="1.6" />
      } @else {
        <!-- cork resting beside the neck -->
        <rect class="vial-cork" x="29" y="6" width="7" height="4.5" rx="1.4" transform="rotate(24 32 8)" />
      }
    </svg>
    @if (label()) {
      <span class="vial-label">{{ preserve().name }}</span>
    }
  `,
})
export class ElixirVial {
  /** The narrow flask: short neck (x18–26) opening into a tall rounded body. */
  protected readonly BODY_D =
    'M 18 9 L 18 15 C 12 17 9 22 9 30 L 9 46 C 9 51 13 53 22 53 C 31 53 35 51 35 46 L 35 30 C 35 22 32 17 26 15 L 26 9 Z';
  protected readonly clipId = 'vialclip-' + ++vialSeq;

  readonly preserve = input.required<Preserve>();
  readonly size = input(1);
  readonly label = input('');

  protected readonly opened = computed(() => !!this.preserve().openedAt);
}

let vialSeq = 0;
