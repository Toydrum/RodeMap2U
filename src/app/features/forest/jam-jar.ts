import { Component, computed, input } from '@angular/core';
import { Preserve } from '../../core/db/schema';
import { FruitSpec, fruitFor } from './flora';
import { FruitGlyph } from './fruit';
import { JAR_GLASS_D } from './jar';
import { hash } from './tree-layout';

let clipSeq = 0;

/**
 * «El frasco de mermelada» (0.0.89) — a SEALED batch on the alacena shelf.
 * Laws: every jam jar renders the SAME size and the SAME fullness — the
 * batch count is never visualized (quantity is not a score); the liquid
 * wears the batch's blended tint (snapshotted at seal); at most three
 * floating fruit silhouettes (id-stable) say "made of fruit" without
 * becoming a second count channel. Cloth cap = sealed. Self-styled.
 */
@Component({
  selector: 'app-jam-jar',
  imports: [FruitGlyph],
  styles: `
    :host {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      max-width: 84px;
    }

    .jar-glass {
      fill: color-mix(in srgb, var(--accent-sky) 10%, transparent);
      stroke: color-mix(in srgb, var(--text) 55%, transparent);
      stroke-width: 1.6;
    }

    .jam-cap {
      fill: color-mix(in srgb, var(--rm-bark) 30%, var(--surface-2));
      stroke: color-mix(in srgb, var(--text) 45%, transparent);
      stroke-width: 1;
    }

    .jam-cap-tie {
      fill: none;
      stroke: color-mix(in srgb, var(--rm-bark) 65%, var(--surface-2));
      stroke-width: 1.1;
      stroke-linecap: round;
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

    [data-theme='terminal'] .jam-liquid {
      opacity: 0.55;
    }

    .jam-name {
      font-size: 0.68rem;
      font-weight: 700;
      color: var(--text);
      text-align: center;
      max-width: 84px;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      line-height: 1.2;
    }

    .jam-month {
      font-size: 0.62rem;
      color: var(--text-faint);
    }
  `,
  template: `
    <svg
      [attr.viewBox]="'0 0 44 54'"
      [attr.width]="44 * size()"
      [attr.height]="54 * size()"
      aria-hidden="true"
    >
      <defs>
        <clipPath [attr.id]="clipId">
          <path [attr.d]="glassD" />
        </clipPath>
      </defs>
      <g [attr.clip-path]="'url(#' + clipId + ')'">
        <!-- sealed = complete: the SAME full level for every jar, forever -->
        <rect class="jam-liquid" x="7" y="16" width="30" height="36" [attr.fill]="preserve().tint" opacity="0.8" />
        <path
          d="M 8 16 C 15 14.8 22 17.2 29 15.6 S 36 16 36 16"
          fill="none"
          [attr.stroke]="lightTint()"
          stroke-width="1.1"
          opacity="0.6"
        />
        @for (chunk of chunks(); track chunk.key) {
          <g [attr.transform]="'translate(' + chunk.x + ' ' + chunk.y + ') rotate(' + chunk.rot + ')'" opacity="0.5">
            <g appFruit [fruit]="chunk.spec" [scale]="0.42" />
          </g>
        }
      </g>
      <path class="jar-glass" [attr.d]="glassD" />
      <path class="jar-shine" d="M 12 16 C 11 24 11 34 12 42" />
      <path class="jar-shine" d="M 32.5 18 C 33.3 26 33.3 32 32.5 40" />
      <!-- the cloth cap over the lip: sealed, kept, done -->
      <path class="jam-cap" d="M 9 8 Q 12 3.4 22 3.4 Q 32 3.4 35 8 L 34 11.5 Q 28 9.4 22 9.4 Q 16 9.4 10 11.5 Z" />
      <path class="jam-cap-tie" d="M 10 10.4 Q 22 13.4 34 10.4" />
    </svg>
    @if (label()) {
      <span class="jam-name">{{ preserve().name }}</span>
      <span class="jam-month">{{ monthWord() }}</span>
    }
  `,
})
export class JamJar {
  protected readonly glassD = JAR_GLASS_D;
  protected readonly clipId = 'jamclip-' + ++clipSeq;

  readonly preserve = input.required<Preserve>();
  /** Render scale — 1 on the shelf, ~0.6 on the mesita. */
  readonly size = input(1);
  /** Show name + month under the glass (shelf yes, mesita no). */
  readonly label = input(true);
  /** Locale month word, computed by the caller. */
  readonly monthWord = input('');

  /** ≤3 floating silhouettes in the jam — id-stable, never a count. A
   *  MIXED jam («del bosque», accent null) shows the pure blended tint
   *  instead — silhouettes of one species would lie about its contents. */
  protected readonly chunks = computed(() => {
    const p = this.preserve();
    if (!p.accent) return [];
    const spec: FruitSpec = fruitFor(p.accent);
    const n = Math.min(3, 1 + (hash(p.id + ':nch') % 3));
    return Array.from({ length: n }, (_, i) => ({
      key: p.id + ':' + i,
      x: 14 + (hash(p.id + ':cx' + i) % 17),
      y: 24 + (hash(p.id + ':cy' + i) % 22),
      rot: -20 + (hash(p.id + ':cr' + i) % 41),
      spec,
    }));
  });

  protected lightTint(): string {
    return this.preserve().tintEdge;
  }
}
