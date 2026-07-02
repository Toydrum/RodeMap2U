import { Injectable, computed, effect, inject } from '@angular/core';
import { ES, Dict } from './es';
import { EN } from './en';
import { Lang } from '../db/schema';
import { SettingsService } from '../repos/settings.service';

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly settings = inject(SettingsService);

  readonly lang = computed<Lang>(() => this.settings.lang());

  /** Whole active dictionary — templates read `i18n.t().section.key`. */
  readonly t = computed<Dict>(() => (this.lang() === 'en' ? EN : ES));

  constructor() {
    effect(() => {
      document.documentElement.lang = this.lang();
    });
  }

  async set(lang: Lang): Promise<void> {
    await this.settings.patch({ lang });
  }

  /** Tiny template filler for strings like "You were here {minutes} minutes". */
  fill(template: string, values: Record<string, string | number>): string {
    return template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ''));
  }
}
