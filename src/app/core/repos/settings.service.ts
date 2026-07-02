import { Injectable, computed, signal } from '@angular/core';
import { DEFAULT_SETTINGS, Settings } from '../db/schema';
import { get, put } from '../db/idb';

interface SettingsRecord {
  key: 'settings';
  value: Settings;
}

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly state = signal<Settings>(DEFAULT_SETTINGS);

  readonly settings = this.state.asReadonly();
  readonly lang = computed(() => this.state().lang);
  readonly theme = computed(() => this.state().theme);
  readonly textSize = computed(() => this.state().textSize);
  readonly dyslexiaFont = computed(() => this.state().dyslexiaFont);

  async load(): Promise<void> {
    try {
      const record = await get<SettingsRecord>('meta', 'settings');
      if (record) {
        // Merge over defaults so new settings keys get sane values after updates.
        this.state.set({ ...DEFAULT_SETTINGS, ...record.value });
      }
    } catch {
      /* storage unavailable — defaults, memory-only session */
    }
  }

  async patch(partial: Partial<Settings>): Promise<void> {
    const next = { ...this.state(), ...partial };
    try {
      await put<SettingsRecord>('meta', { key: 'settings', value: next });
    } catch {
      /* memory-only session */
    }
    this.state.set(next);
  }
}
