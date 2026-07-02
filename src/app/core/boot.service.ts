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
  }
}
