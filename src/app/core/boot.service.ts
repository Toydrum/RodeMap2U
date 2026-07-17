import { Injectable, inject } from '@angular/core';
import { TreesRepo } from './repos/trees.repo';
import { NodesRepo } from './repos/nodes.repo';
import { CheckinsRepo } from './repos/checkins.repo';
import { SessionsRepo } from './repos/sessions.repo';
import { HarvestsRepo } from './repos/harvests.repo';
import { PreservesRepo } from './repos/preserves.repo';
import { SettingsService } from './repos/settings.service';
import { onDbChange } from './db/broadcast';
import { storageAvailable } from './db/idb';
import { ToastService } from '../shared/ui/toast.service';
import { I18nService } from './i18n/i18n.service';

/** Loads every store into memory before first render and wires cross-tab refresh. */
@Injectable({ providedIn: 'root' })
export class BootService {
  private readonly trees = inject(TreesRepo);
  private readonly nodes = inject(NodesRepo);
  private readonly checkins = inject(CheckinsRepo);
  private readonly sessions = inject(SessionsRepo);
  private readonly harvests = inject(HarvestsRepo);
  private readonly preserves = inject(PreservesRepo);
  private readonly settings = inject(SettingsService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);

  async init(): Promise<void> {
    // Loads catch their own storage failures; allSettled is belt-and-braces —
    // a broken IndexedDB must never leave the user staring at a blank screen.
    await Promise.allSettled([
      this.trees.load(),
      this.nodes.load(),
      this.checkins.load(),
      this.sessions.load(),
      this.harvests.load(),
      this.preserves.load(),
      this.settings.load(),
    ]);

    onDbChange(({ store, ids }) => {
      // Settings travel too — lastCheckInAt/todayIntentions/lastWhisperAt
      // are behavioral, and a tab that can't see them re-routes to a
      // check-in already done and whispers on its own clock.
      if (store === 'meta') {
        if (ids.includes('settings')) void this.settings.load();
        return;
      }
      const repo =
        store === 'trees' ? this.trees
        : store === 'nodes' ? this.nodes
        : store === 'checkins' ? this.checkins
        : store === 'sessions' ? this.sessions
        : store === 'harvests' ? this.harvests
        : store === 'preserves' ? this.preserves
        : null;
      void repo?.refreshFromDisk(ids);
    });

    await this.maybeSeedDemo();

    // «La cosecha» v5 wake-up: AFTER the demo seed so a seeded showcase
    // forest gets its pantry too. One-time, sentinel-sealed.
    await this.harvests.backfillIfNeeded(this.nodes.byId(), this.trees.byId());

    // Memory-only degrade must never be SILENT: an empty forest over an
    // intact disk store reads as data loss, and work done in this session
    // evaporates on reload. One honest sticky notice.
    if (!(await storageAvailable())) {
      this.toast.show({ message: this.i18n.t().app.memoryOnly, sticky: true });
    }
  }

  /** `?seed=demo` on an EMPTY store loads a small showcase forest. */
  private async maybeSeedDemo(): Promise<void> {
    if (!location.search.includes('seed=demo')) return;
    if (this.trees.all().length) return;
    const demo = await import('./demo-seed');
    await this.trees.saveMany(demo.DEMO_TREES);
    await this.nodes.saveMany(demo.DEMO_NODES);
    await this.checkins.saveMany(demo.DEMO_CHECKINS);
    await this.sessions.saveMany(demo.DEMO_SESSIONS);
    // The showcase conservería (0.0.106): HOMED fruits + their jars land
    // BEFORE the backfill (it skips existing ids, so homes survive).
    await this.harvests.saveMany(demo.DEMO_HARVESTS);
    await this.preserves.saveMany(demo.DEMO_PRESERVES);
    await this.settings.patch(demo.DEMO_SETTINGS_PATCH);
  }
}
