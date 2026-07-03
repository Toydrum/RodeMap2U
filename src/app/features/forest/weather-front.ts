import { Component, computed, input } from '@angular/core';
import { Feeling } from '../../core/db/schema';

/**
 * Near weather, drawn OVER the scenery (pointer-transparent): rain falls
 * in front of the meadow and fog veils the ground, so no weather layer
 * ever ends in a hard line where the landscape begins. Far weather
 * (clouds, lightning, sky mist, mountains) stays in SceneBackdrop.
 */
@Component({
  selector: 'app-weather-front',
  host: { '[class]': '"front-" + (mood() ?? "calm")', 'aria-hidden': 'true' },
  template: `
    @if (raining()) {
      <div class="rain-front"></div>
    }
    @if (mood() === 'foggy') {
      <div class="veil"></div>
      <div class="drift"></div>
    }
  `,
  styleUrl: './weather-front.scss',
})
export class WeatherFront {
  /** Latest check-in feeling — same input the backdrop takes. */
  readonly mood = input<Feeling | null>(null);

  protected readonly raining = computed(() => this.mood() === 'heavy' || this.mood() === 'stormy');
}
