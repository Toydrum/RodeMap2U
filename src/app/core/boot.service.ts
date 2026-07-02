import { Injectable, inject } from '@angular/core';
import { TreesRepo } from './repos/trees.repo';
import { NodesRepo } from './repos/nodes.repo';
import { CheckinsRepo } from './repos/checkins.repo';
import { SessionsRepo } from './repos/sessions.repo';
import { SettingsService } from './repos/settings.service';
import { onDbChange } from './db/broadcast';

/** Loads every store into memory before first render and wires cross-tab refresh. */
@Injectable({ providedIn: 'root' })
export class BootService {
  private readonly trees = inject(TreesRepo);
  private readonly nodes = inject(NodesRepo);
  private readonly checkins = inject(CheckinsRepo);
  private readonly sessions = inject(SessionsRepo);
  private readonly settings = inject(SettingsService);

  async init(): Promise<void> {
    // Loads catch their own storage failures; allSettled is belt-and-braces —
    // a broken IndexedDB must never leave the user staring at a blank screen.
    await Promise.allSettled([
      this.trees.load(),
      this.nodes.load(),
      this.checkins.load(),
      this.sessions.load(),
      this.settings.load(),
    ]);

    onDbChange(({ store, ids }) => {
      const repo =
        store === 'trees' ? this.trees
        : store === 'nodes' ? this.nodes
        : store === 'checkins' ? this.checkins
        : store === 'sessions' ? this.sessions
        : null;
      void repo?.refreshFromDisk(ids);
    });

    await this.maybeSeedDemo();
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
    await this.settings.patch(demo.DEMO_SETTINGS_PATCH);
  }
}
