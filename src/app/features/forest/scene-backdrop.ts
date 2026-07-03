import { Component, input } from '@angular/core';

/**
 * Shared nature backdrop for forest and tree views: sun, drifting clouds
 * (parked under reduced motion), soaring birds, and the distant mountain
 * ranges with a pine treeline. Purely decorative, pointer-events: none.
 */
@Component({
  selector: 'app-scene-backdrop',
  template: `
    <div class="sky" aria-hidden="true">
      <div class="sun"></div>
      <div class="cloud c1"></div>
      <div class="cloud c2"></div>
      <div class="cloud c3"></div>
      <svg class="bird b1" viewBox="0 0 18 6"><path d="M1 5 Q5 1 9 5 M9 5 Q13 1 17 5"/></svg>
      <svg class="bird b2" viewBox="0 0 18 6"><path d="M1 5 Q5 1 9 5 M9 5 Q13 1 17 5"/></svg>
      <svg class="bird b3" viewBox="0 0 18 6"><path d="M1 5 Q5 1 9 5 M9 5 Q13 1 17 5"/></svg>
    </div>

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

  protected readonly treelineXs = [40, 120, 210, 330, 420, 505, 610, 700, 800, 890, 960];
}
