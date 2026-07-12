import { Injectable, computed, signal } from '@angular/core';
import { DEFAULT_SETTINGS, Settings } from '../db/schema';
import { get, put } from '../db/idb';
import { broadcastChange } from '../db/broadcast';

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
    // Merge over the DISK copy, not just memory: another tab may have
    // patched a behavioral key (lastCheckInAt, todayIntentions) since we
    // loaded — read-modify-write over stale memory silently clobbered it.
    let base = this.state();
    try {
      const record = await get<SettingsRecord>('meta', 'settings');
      if (record) base = { ...DEFAULT_SETTINGS, ...record.value };
    } catch {
      /* memory-only session — merge over memory */
    }
    const next = { ...base, ...partial };
    try {
      await put<SettingsRecord>('meta', { key: 'settings', value: next });
    } catch {
      /* memory-only session */
    }
    this.state.set(next);
    // Settings used to be invisible to other tabs until reload: tab B kept
    // re-routing to a check-in already done in tab A and whispered on its
    // own clock. The sync engine ignores 'meta' — this reaches tabs only.
    broadcastChange({ store: 'meta', ids: ['settings'] });
  }
}
