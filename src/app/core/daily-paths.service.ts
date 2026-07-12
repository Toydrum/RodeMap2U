import { Injectable, effect, inject, untracked } from '@angular/core';
import { NodesRepo } from './repos/nodes.repo';
import { stamp } from './db/schema';
import { today } from './time';

/** Local day (YYYY-MM-DD) of an epoch-ms stamp. */
function dayOf(epochMs: number): string {
  const d = new Date(epochMs);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * «Senderos» — daily repeating step paths. A steps parent marked
 * `repeatsDaily` quietly starts over each morning: steps bloomed on a
 * PREVIOUS day reset to seed. Today's blooms are never touched (the sweep
 * is idempotent within a day), nothing is counted, nothing is kept — no
 * history, no streaks, no "you missed yesterday". today() is reactive, so
 * the sweep also fires at midnight in an open tab.
 */
@Injectable({ providedIn: 'root' })
export class DailyPathsService {
  private readonly nodes = inject(NodesRepo);

  constructor() {
    effect(() => {
      const day = today(); // reactive: boot + midnight flip
      untracked(() => void this.sweep(day));
    });
  }

  private async sweep(day: string): Promise<void> {
    const parents = this.nodes
      .visible()
      .filter((n) => n.repeatsDaily && n.flow === 'steps' && n.status !== 'branched');
    if (!parents.length) return;
    const now = Date.now();
    const resets = [];
    for (const parent of parents) {
      for (const child of this.nodes.childrenOf(parent)) {
        if (child.status === 'achieved' && child.achievedAt && dayOf(child.achievedAt) < day) {
          resets.push(stamp({ ...child, status: 'seed' as const, achievedAt: null }, now));
        }
      }
    }
    if (resets.length) await this.nodes.saveMany(resets);
  }
}
