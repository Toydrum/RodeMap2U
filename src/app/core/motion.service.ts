import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { SettingsService } from './repos/settings.service';

/**
 * THE single source of truth for motion. Every animation in the app reads
 * `reduced()`; a global `.reduce-motion` class on <html> is the CSS backstop.
 */
@Injectable({ providedIn: 'root' })
export class MotionService {
  private readonly settings = inject(SettingsService);
  private readonly systemReduced = signal(
    matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  readonly reduced = computed(() => {
    const pref = this.settings.settings().reduceMotion;
    if (pref === 'on') return true;
    if (pref === 'off') return false;
    return this.systemReduced();
  });

  constructor() {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    media.addEventListener('change', (e) => this.systemReduced.set(e.matches));
    effect(() => {
      document.documentElement.classList.toggle('reduce-motion', this.reduced());
    });
  }
}
