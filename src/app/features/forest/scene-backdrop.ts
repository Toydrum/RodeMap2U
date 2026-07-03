import { Component, computed, input } from '@angular/core';
import { Feeling } from '../../core/db/schema';

/**
 * Shared nature backdrop for forest and tree views: sun, drifting clouds
 * (parked under reduced motion), soaring birds, and the distant mountain
 * ranges with a pine treeline. Purely decorative, pointer-events: none.
 *
 * `mood` mirrors the latest check-in: the sky feels what you feel, while
 * the trees stand safe. Sunny breathes light motes, foggy drifts mist
 * banks, heavy drizzles, stormy rains with soft slow lightning (fully
 * disabled under reduced motion — no photosensitive flashing, ever).
 */
@Component({
  selector: 'app-scene-backdrop',
  host: { '[class]': '"mood-" + (mood() ?? "calm")' },
  template: `
    <div class="mood-tint" aria-hidden="true"></div>

    <div class="sky" aria-hidden="true">
      <div class="sun"></div>
      <div class="cloud c1"></div>
      <div class="cloud c2"></div>
      <div class="cloud c3"></div>
      @if (isGloomy()) {
        <div class="cloud storm s1"></div>
        <div class="cloud storm s2"></div>
      }
      @if (mood() === 'stormy') {
        <svg class="bolt b1" viewBox="0 0 24 44"><path d="M 13 2 L 6 22 L 12 22 L 8 42 L 19 18 L 12 18 Z"/></svg>
        <svg class="bolt b2" viewBox="0 0 24 44"><path d="M 13 2 L 6 22 L 12 22 L 8 42 L 19 18 L 12 18 Z"/></svg>
      }
      <svg class="bird b1" viewBox="0 0 18 6"><path d="M1 5 Q5 1 9 5 M9 5 Q13 1 17 5"/></svg>
      <svg class="bird b2" viewBox="0 0 18 6"><path d="M1 5 Q5 1 9 5 M9 5 Q13 1 17 5"/></svg>
      <svg class="bird b3" viewBox="0 0 18 6"><path d="M1 5 Q5 1 9 5 M9 5 Q13 1 17 5"/></svg>
    </div>

    @if (mood() === 'sunny') {
      <div class="motes" aria-hidden="true">
        <span class="mote m1"></span>
        <span class="mote m2"></span>
        <span class="mote m3"></span>
        <span class="mote m4"></span>
        <span class="mote m5"></span>
      </div>
    }

    @if (mood() === 'foggy') {
      <div class="fog" aria-hidden="true"></div>
      <!-- Rides the mountains' base so their hard bottom edge dissolves in milk -->
      <div class="fog-seam" [style.bottom]="seamBottom()" aria-hidden="true"></div>
      <div class="mist far" aria-hidden="true"></div>
      <div class="mist mid" aria-hidden="true"></div>
      <div class="mist near" aria-hidden="true"></div>
    }


    <svg
      class="mountains"
      [style.bottom]="mountainsBottom()"
      viewBox="0 0 1000 150"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
    >
      <!-- Ranges shade from lit summits to deep bases — depth without outlines -->
      <defs>
        <linearGradient id="rmGradFarthest" x1="0" y1="0" x2="0" y2="1">
          <stop class="g-top" offset="0" />
          <stop class="g-bot" offset="1" />
        </linearGradient>
        <linearGradient id="rmGradFar" x1="0" y1="0" x2="0" y2="1">
          <stop class="g-top" offset="0" />
          <stop class="g-bot" offset="1" />
        </linearGradient>
        <linearGradient id="rmGradNear" x1="0" y1="0" x2="0" y2="1">
          <stop class="g-top" offset="0" />
          <stop class="g-bot" offset="1" />
        </linearGradient>
      </defs>
      <path class="range farthest" fill="url(#rmGradFarthest)" [attr.d]="farthestD" />
      <g class="massif">
        <path class="range far-range" fill="url(#rmGradFar)" [attr.d]="farD" />
        <g class="caps">
          <path d="M 277 50 L 290 38 L 303 50 Q 290 45 277 50 Z" />
          <path d="M 509 68 L 520 58 L 531 68 Q 520 64 509 68 Z" />
          <path d="M 748 59 L 760 48 L 772 59 Q 760 54 748 59 Z" />
        </g>
      </g>
      <path class="range near-range" fill="url(#rmGradNear)" [attr.d]="nearD" />
      <g class="treeline">
        @for (x of treelineXs; track x) {
          <path [attr.d]="'M ' + x + ' 150 l 7 -16 l 7 16 Z'" />
          <path [attr.d]="'M ' + (x + 16) + ' 150 l 5 -11 l 5 11 Z'" />
        }
      </g>
    </svg>

    <!-- Distant meadow: rolling far hills + tiny groves before the peaks -->
    <svg
      class="far-meadow"
      [style.bottom]="farMeadowBottom()"
      viewBox="0 0 1000 72"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
    >
      <path class="band a" d="M 0 72 L 0 34 Q 130 22 260 32 T 520 28 T 760 34 T 1000 26 L 1000 72 Z" />
      <path class="band b" d="M 0 72 L 0 54 Q 160 42 320 52 T 640 48 T 1000 52 L 1000 72 Z" />
      @for (grove of farFlora; track $index) {
        <g class="grove" [attr.transform]="'translate(' + grove.x + ' ' + grove.y + ') scale(' + grove.s + ')'">
          <ellipse rx="9" ry="5" />
          <ellipse cx="8" cy="1.5" rx="6" ry="3.5" />
          <ellipse cx="-8" cy="1" rx="5" ry="3" />
        </g>
      }
    </svg>
  `,
  styleUrl: './scene-backdrop.scss',
})
export class SceneBackdrop {
  /** Where the mountain band rests (CSS length from the container's bottom). */
  readonly mountainsBottom = input('min(400px, 52vh)');

  /** Latest check-in feeling — the sky mirrors it. null = calm default. */
  readonly mood = input<Feeling | null>(null);

  protected readonly isGloomy = computed(() => this.mood() === 'heavy' || this.mood() === 'stormy');

  /** The seam band straddles the mountains' bottom edge, wherever it rests. */
  protected readonly seamBottom = computed(() => `calc(${this.mountainsBottom()} - 130px)`);

  /** The far meadow hugs the mountains' base, spilling a little below it. */
  protected readonly farMeadowBottom = computed(() => `calc(${this.mountainsBottom()} - 46px)`);

  /** Tiny distant groves dotting the far hills (fixed-seed). */
  protected readonly farFlora = Array.from({ length: 9 }, (_, i) => {
    const h = (i * 2654435761) >>> 0;
    return { x: 30 + (h % 940), y: 34 + ((h >> 6) % 22), s: 0.5 + ((h >> 3) % 55) / 100 };
  });

  protected readonly treelineXs = [40, 120, 210, 330, 420, 505, 610, 700, 800, 890, 960];

  protected readonly farthestD =
    'M -20 150 L 110 92 L 240 132 L 400 76 L 545 128 L 690 86 L 830 134 L 1020 96 L 1020 150 Z';
  protected readonly farD =
    'M -20 150 L 90 66 L 175 118 L 290 38 L 400 122 L 520 58 L 640 128 L 760 48 L 880 116 L 1020 70 L 1020 150 Z';
  protected readonly nearD =
    'M -20 150 L 60 96 L 170 140 L 310 84 L 430 142 L 585 92 L 720 146 L 850 96 L 1020 138 L 1020 150 Z';
}
