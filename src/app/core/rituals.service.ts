import { Injectable, effect, inject, untracked } from '@angular/core';
import { NodesRepo } from './repos/nodes.repo';
import { TreesRepo } from './repos/trees.repo';
import { stamp } from './db/schema';
import { cadenceOf, frozenBeforeCadence, shouldReset } from './cadence';
import { today } from './time';

/**
 * «Los rituales» (grew from «senderos» 0.0.72 → «las piedritas» 0.0.103) —
 * recurring branches that quietly start over. TWO shapes, one sweep:
 *   · ritual PATH — a steps parent with a cadence: pasitos bloomed in a
 *     PREVIOUS period reset to seed (the classic sendero).
 *   · ritual LEAF — a lone branch with a cadence: the branch ITSELF resets.
 * Cadences ('daily' | 'weekly' | weekdays) live in core/cadence.ts; for
 * 'daily' the behavior is byte-equal to the original sendero sweep. This
 * period's blooms are never touched (idempotent within a period), nothing
 * is counted, nothing is kept — no history, no streaks, no "you missed".
 * today() is reactive, so the sweep also fires at midnight in an open tab.
 * THE INVARIANT surfaces lean on: live status IS «done this period» — this
 * sweep is the one clock that resets it; nobody else computes membership.
 */
@Injectable({ providedIn: 'root' })
export class RitualsService {
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
    const now = Date.now();
    const resets = [];
    for (const n of this.nodes.visible()) {
      if (!liveTrees.has(n.treeId)) continue;
      const cadence = cadenceOf(n);
      if (!cadence) continue;
      if (n.flow === 'steps') {
        // Ritual PATH: only LIVE ones reset — «descansando» PAUSES the path
        // (yesterday's blooms stay put until it wakes), achieved retires it,
        // branched dissolves it — matching the caminito lens in almanac.ts.
        if (n.status !== 'seed' && n.status !== 'growing') continue;
        for (const child of this.nodes.childrenOf(n)) {
          // «La historia se queda» (0.0.106): blooms from before the cadence
          // existed are frozen history — converting a lived branch used to
          // silently un-achieve its past overnight.
          if (child.status === 'achieved' && child.achievedAt && frozenBeforeCadence(child.achievedAt, n)) continue;
          if (child.status === 'achieved' && child.achievedAt && shouldReset(cadence, child.achievedAt, day)) {
            resets.push(stamp({ ...child, status: 'seed' as const, achievedAt: null }, now));
          }
        }
      } else if (n.status === 'achieved' && n.achievedAt && shouldReset(cadence, n.achievedAt, day)) {
        // Ritual LEAF: the branch itself dawns clean. `resting` pauses (not
        // achieved → skipped), `branched` dissolves (cadenceOf holds but the
        // status guard here never matches). Retiring a leaf = clearing its
        // cadence — after that, its standing bloom is final.
        resets.push(stamp({ ...n, status: 'seed' as const, achievedAt: null }, now));
      }
    }
    if (resets.length) await this.nodes.saveMany(resets);
  }
}
