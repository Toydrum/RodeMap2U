import { Injectable, effect, inject, untracked } from '@angular/core';
import { NodesRepo } from './repos/nodes.repo';
import { TreesRepo } from './repos/trees.repo';
import { stamp } from './db/schema';
import { dayOf, today } from './time';

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
  private readonly trees = inject(TreesRepo);

  constructor() {
    effect(() => {
      const day = today(); // reactive: boot + midnight flip
      untracked(() => void this.sweep(day));
    });
  }

  private async sweep(day: string): Promise<void> {
    // nodes.visible() only knows node-level archives — archiving a TREE
    // doesn't cascade, so without this set the sweep kept resetting paths
    // inside archived trees forever (invisible writes + sync churn, and a
    // restored tree found yesterday's progress silently erased).
    const liveTrees = new Set(this.trees.active().map((t) => t.id));
    // Only LIVE senderos reset: «descansando» PAUSES the path (yesterday's
    // blooms stay put until it wakes), achieved retires it, branched
    // dissolved it — matching the caminito lens in almanac.ts.
    const parents = this.nodes
      .visible()
      .filter(
        (n) =>
          n.repeatsDaily &&
          n.flow === 'steps' &&
          (n.status === 'seed' || n.status === 'growing') &&
          liveTrees.has(n.treeId),
      );
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
