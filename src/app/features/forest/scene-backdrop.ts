import { Component, computed, input } from '@angular/core';
import { Feeling } from '../../core/db/schema';

/**
 * Shared nature backdrop for forest and tree views: sun, drifting clouds
 * (parked under reduced motion), soaring birds, and the distant mountain
 * ranges with a pine treeline. Purely decorative, pointer-events: none.
 *
 * `mood` mirrors the latest check-in: the sky feels what you feel, while
 * the trees stand safe. Stormy brings soft, slow lightning (fully disabled
 * under reduced motion — no photosensitive flashing, ever).
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

    @if (mood() === 'foggy') {
      <div class="fog" aria-hidden="true"></div>
    }

    @if (mood() === 'stormy') {
      <div class="rain" aria-hidden="true"></div>
    }

    <svg
      class="mountains"
      [style.bottom]="mountainsBottom()"
      viewBox="0 0 1000 150"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
    >
      <path class="range far-range" d="M -20 150 L 90 66 L 175 118 L 290 38 L 400 122 L 520 58 L 640 128 L 760 48 L 880 116 L 1020 70 L 1020 150 Z" />
      <path class="range near-range" d="M -20 150 L 60 96 L 170 140 L 310 84 L 430 142 L 585 92 L 720 146 L 850 96 L 1020 138 L 1020 150 Z" />
      <g class="treeline">
        @for (x of treelineXs; track x) {
          <path [attr.d]="'M ' + x + ' 150 l 7 -16 l 7 16 Z'" />
          <path [attr.d]="'M ' + (x + 16) + ' 150 l 5 -11 l 5 11 Z'" />
        }
      </g>
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

  protected readonly treelineXs = [40, 120, 210, 330, 420, 505, 610, 700, 800, 890, 960];
}
