import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { ES, Dict } from './es';
import { Lang } from '../db/schema';
import { SettingsService } from '../repos/settings.service';

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly settings = inject(SettingsService);

  readonly lang = computed<Lang>(() => this.settings.lang());

  /** EN arrives on demand (0.0.115 bundle): most installs never leave ES,
   *  so the English dictionary shouldn't ride the first paint (~50 KB).
   *  ES answers while the chunk loads — a blink at most, EN users only. */
  private readonly enDict = signal<Dict | null>(null);

  /** Whole active dictionary — templates read `i18n.t().section.key`. */
  readonly t = computed<Dict>(() =>
    this.lang() === 'en' ? (this.enDict() ?? ES) : ES,
  );

  constructor() {
    effect(() => {
      document.documentElement.lang = this.lang();
    });
    effect(() => {
      if (this.lang() === 'en' && !this.enDict()) {
        void import('./en').then((m) => this.enDict.set(m.EN));
      }
    });
  }

  async set(lang: Lang): Promise<void> {
    await this.settings.patch({ lang });
  }

  /** Tiny template filler for strings like "You were here {minutes} minutes". */
  fill(template: string, values: Record<string, string | number>): string {
    return template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ''));
  }

  /** Whole-sentence pluralization: pick the form, then fill {count}.
   *  Pairs live in the dictionaries so ES/EN parity stays compiler-checked. */
  plural(count: number, forms: { one: string; many: string }): string {
    return this.fill(count === 1 ? forms.one : forms.many, { count });
  }
}
