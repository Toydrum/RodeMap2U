import { Component, computed, input } from '@angular/core';
import { JarVessel, Preserve } from '../../core/db/schema';
import { FruitSpec, fruitFor } from './flora';
import { FruitGlyph } from './fruit';
import { FRASCOTE_GLASS_D, FRASQUITO_GLASS_D, JAR_GLASS_D } from './jar';
import { hash } from './tree-layout';

let clipSeq = 0;

/** Per-vessel geometry — three SILHOUETTES, one law each (0.0.90). */
interface VesselGeo {
  glass: string;
  /** Cloth cap over the mouth + its tie line. */
  cap: string;
  tie: string;
  /** Jam surface (liquid top) + body rect. */
  liquidY: number;
  liquidX: number;
  liquidW: number;
  /** Open-mouth line when «disfrutada». */
  mouth: { cx: number; cy: number; rx: number };
  /** Where the lifted cap rests behind the shoulder. */
  capAway: string;
}

const VESSELS: Record<JarVessel, VesselGeo> = {
  frasquito: {
    glass: FRASQUITO_GLASS_D,
    cap: 'M 10 21 Q 13 16.6 22 16.6 Q 31 16.6 34 21 L 33 24.5 Q 28 22.6 22 22.6 Q 16 22.6 11 24.5 Z',
    tie: 'M 11 23.6 Q 22 26.4 33 23.6',
    liquidY: 26,
    liquidX: 6,
    liquidW: 32,
    mouth: { cx: 22, cy: 22.6, rx: 9 },
    capAway: 'translate(11 -5) rotate(24 22 22)',
  },
  frasco: {
    glass: JAR_GLASS_D,
    cap: 'M 9 8 Q 12 3.4 22 3.4 Q 32 3.4 35 8 L 34 11.5 Q 28 9.4 22 9.4 Q 16 9.4 10 11.5 Z',
    tie: 'M 10 10.4 Q 22 13.4 34 10.4',
    liquidY: 16,
    liquidX: 7,
    liquidW: 30,
    mouth: { cx: 22, cy: 9.4, rx: 10 },
    capAway: 'translate(12 -3) rotate(26 22 9)',
  },
  frascote: {
    glass: FRASCOTE_GLASS_D,
    cap: 'M 7 7 Q 10 2 22 2 Q 34 2 37 7 L 36 10.5 Q 29 8.4 22 8.4 Q 15 8.4 8 10.5 Z',
    tie: 'M 8 9.4 Q 22 12.4 36 9.4',
    liquidY: 15,
    liquidX: 4,
    liquidW: 36,
    mouth: { cx: 22, cy: 8.4, rx: 12 },
    capAway: 'translate(13 -3) rotate(26 22 8)',
  },
};

/**
 * «El frasco de mermelada» (0.0.89; vessels + premio 0.0.90) — a SEALED
 * batch on the alacena shelf. Laws: the VESSEL is a seal-time snapshot
 * («el frasco sirve a la fruta» — frasquito/frasco/frascote by batch,
 * distinct silhouettes, never one glass scaled); within every vessel the
 * FULLNESS law holds (each jar renders full of its own jam — quantity is
 * never a fill line); a 🎀 bow on the tie marks a jar holding a premio
 * (gift inside — orthogonal to size, never a count); an OPENED jar stays
 * «disfrutada» forever — lid resting behind the shoulder, bow undone,
 * liquid softer (0.65) — enjoyed like a lit candle, never greyed. Mixed
 * jams show pure tint (single-species silhouettes would lie). Self-styled.
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

    .jam-bow {
      fill: color-mix(in srgb, var(--accent-rose) 72%, var(--surface));
      stroke: color-mix(in srgb, var(--text) 35%, transparent);
      stroke-width: 0.6;
    }

    .jam-bow-loose {
      fill: none;
      stroke: color-mix(in srgb, var(--accent-rose) 72%, var(--surface));
      stroke-width: 1.3;
      stroke-linecap: round;
    }

    .jar-mouth {
      fill: none;
      stroke: color-mix(in srgb, var(--text) 40%, transparent);
      stroke-width: 1.1;
    }

    .jam-cap.away {
      opacity: 0.55;
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
          <path [attr.d]="geo().glass" />
        </clipPath>
      </defs>
      <g [attr.clip-path]="'url(#' + clipId + ')'">
        <!-- sealed = complete: full of its own jam. Consumed (0.0.95): the
             jelly drains — an opened jar keeps its glass, lid, bow and label
             but empties (the jam was the consumable; the FRUITS/memories/
             register are conserved elsewhere — «nada se gasta»). -->
        @if (!opened()) {
          <rect
            class="jam-liquid"
            [attr.x]="geo().liquidX"
            [attr.y]="geo().liquidY"
            [attr.width]="geo().liquidW"
            height="40"
            [attr.fill]="preserve().tint"
            opacity="0.8"
          />
          <path
            [attr.d]="waveD()"
            fill="none"
            [attr.stroke]="preserve().tintEdge"
            stroke-width="1.1"
            opacity="0.6"
          />
          @for (chunk of chunks(); track chunk.key) {
            <g [attr.transform]="'translate(' + chunk.x + ' ' + chunk.y + ') rotate(' + chunk.rot + ')'" opacity="0.5">
              <g appFruit [fruit]="chunk.spec" [scale]="0.42" />
            </g>
          }
        } @else {
          <!-- a faint dreg at the very bottom — enjoyed, not sterile. -->
          <rect
            class="jam-dreg"
            [attr.x]="geo().liquidX"
            y="47"
            [attr.width]="geo().liquidW"
            height="6"
            [attr.fill]="preserve().tint"
            opacity="0.32"
          />
        }
      </g>
      <path class="jar-glass" [attr.d]="geo().glass" />
      <path class="jar-shine" d="M 12 22 C 11 28 11 36 12 42" />
      <path class="jar-shine" d="M 32.5 24 C 33.3 30 33.3 36 32.5 40" />
      @if (!opened()) {
        <!-- the cloth cap over the lip: sealed, kept, done -->
        <path class="jam-cap" [attr.d]="geo().cap" />
        <path class="jam-cap-tie" [attr.d]="geo().tie" />
        @if (hasPremio()) {
          <!-- 🎀 the bow: a gift waits inside — never a count, never a badge -->
          <g class="jam-ribbon" [attr.transform]="'translate(22 ' + bowY() + ')'">
            <path class="jam-bow" d="M 0 0 C -2.4 -2.6 -5.4 -1.8 -4.6 0.6 C -4 2.4 -1.6 1.6 0 0 Z" />
            <path class="jam-bow" d="M 0 0 C 2.4 -2.6 5.4 -1.8 4.6 0.6 C 4 2.4 1.6 1.6 0 0 Z" />
            <circle class="jam-bow" r="1.1" />
          </g>
        }
      } @else {
        <!-- «disfrutada»: lid resting behind the shoulder, open mouth,
             a loose ribbon end — enjoyed, never spent-looking -->
        <ellipse
          class="jar-mouth"
          [attr.cx]="geo().mouth.cx"
          [attr.cy]="geo().mouth.cy"
          [attr.rx]="geo().mouth.rx"
          ry="2.2"
        />
        <g [attr.transform]="geo().capAway">
          <path class="jam-cap away" [attr.d]="geo().cap" />
        </g>
        @if (hasPremio()) {
          <path
            class="jam-bow-loose"
            [attr.d]="'M ' + (geo().mouth.cx + geo().mouth.rx - 2) + ' ' + (geo().mouth.cy + 1) + ' q 2.4 3 0.8 6 q -1.2 2.4 1 4'"
          />
        }
      }
    </svg>
    @if (label()) {
      <span class="jam-name">{{ preserve().name }}</span>
      <span class="jam-month">{{ monthWord() }}</span>
    }
  `,
})
export class JamJar {
  protected readonly clipId = 'jamclip-' + ++clipSeq;

  readonly preserve = input.required<Preserve>();
  /** Render scale — 1 on the shelf, ~0.6 on the mesita. */
  readonly size = input(1);
  /** Show name + month under the glass (shelf yes, mesita no). */
  readonly label = input(true);
  /** Locale month word, computed by the caller. */
  readonly monthWord = input('');

  /** Pre-v7 jars read as frasco forever (no retro-resizing). */
  protected readonly geo = computed<VesselGeo>(() => VESSELS[this.preserve().size ?? 'frasco']);

  protected readonly opened = computed(() => !!this.preserve().openedAt);
  protected readonly hasPremio = computed(() => !!this.preserve().premio);

  protected bowY(): number {
    return this.geo().mouth.cy + 2.2;
  }

  protected waveD(): string {
    const g = this.geo();
    const y = g.liquidY;
    const x0 = g.liquidX + 1;
    const x1 = g.liquidX + g.liquidW - 1;
    const mid = (x0 + x1) / 2;
    return `M ${x0} ${y} C ${x0 + 7} ${y - 1.4}, ${mid} ${y + 1.2}, ${mid + 7} ${y - 1} S ${x1} ${y}, ${x1} ${y}`;
  }

  /** ≤3 floating silhouettes in the jam — id-stable, never a count. A
   *  MIXED jam («del bosque», accent null) shows the pure blended tint
   *  instead — silhouettes of one species would lie about its contents. */
  protected readonly chunks = computed(() => {
    const p = this.preserve();
    if (!p.accent) return [];
    const spec: FruitSpec = fruitFor(p.accent);
    const g = this.geo();
    const n = Math.min(3, 1 + (hash(p.id + ':nch') % 3));
    return Array.from({ length: n }, (_, i) => ({
      key: p.id + ':' + i,
      x: g.liquidX + 7 + (hash(p.id + ':cx' + i) % Math.max(8, g.liquidW - 14)),
      y: g.liquidY + 7 + (hash(p.id + ':cy' + i) % Math.max(6, 44 - g.liquidY)),
      rot: -20 + (hash(p.id + ':cr' + i) % 41),
      spec,
    }));
  });
}
