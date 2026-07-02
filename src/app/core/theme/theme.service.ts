import { Injectable, effect, inject } from '@angular/core';
import { SettingsService } from '../repos/settings.service';
import { ThemeName, TextSize } from '../db/schema';

/** Applies theme + text prefs as attributes/classes on <html>. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly settings = inject(SettingsService);

  /** `?theme=` session override — demos and headless screenshots; never persisted. */
  private readonly queryOverride = new URLSearchParams(location.search).get('theme');

  constructor() {
    effect(() => {
      const root = document.documentElement;
      const theme =
        this.queryOverride === 'terminal' || this.queryOverride === 'organic'
          ? this.queryOverride
          : this.settings.theme();
      root.setAttribute('data-theme', theme);
      root.setAttribute('data-text', this.settings.textSize());
      root.classList.toggle('font-dyslexia', this.settings.dyslexiaFont());
    });
  }

  async setTheme(theme: ThemeName): Promise<void> {
    await this.settings.patch({ theme });
  }

  async setTextSize(textSize: TextSize): Promise<void> {
    await this.settings.patch({ textSize });
  }
}
