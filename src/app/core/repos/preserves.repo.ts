import { Injectable, computed } from '@angular/core';
import { Preserve } from '../db/schema';
import { StoreName } from '../db/idb';
import { RecordsRepo } from './records.repo';
import { isElixir, isPending, isSealedJam } from '../harvest';

/**
 * «La conservería» (0.0.89) — sealed jam batches. See the Preserve interface
 * in schema.ts for the laws (made OF fruits, never an exchange; final after
 * the undo window; same size + same fullness always — quantity is never
 * visualized; never counted anywhere). Sealing/unsealing is orchestrated by
 * ConserveriaService (atomic across stores); this repo is the record home.
 */
@Injectable({ providedIn: 'root' })
export class PreservesRepo extends RecordsRepo<Preserve> {
  protected readonly store: StoreName = 'preserves';

  /** The shelf's one ordering: newest making first — chronological history,
   *  NEVER a species grid. */
  readonly newestFirst = computed(() =>
    [...this.all()].sort((a, b) => b.madeAt - a.madeAt || (a.id < b.id ? -1 : 1)),
  );

  /** «La promesa» (0.0.93) — goal jars still filling, newest promise first. */
  readonly pending = computed(() =>
    [...this.all()]
      .filter((p) => !isElixir(p) && isPending(p))
      .sort((a, b) => (b.plannedAt ?? 0) - (a.plannedAt ?? 0) || (a.id < b.id ? -1 : 1)),
  );

  /** Finished jams for the alacena — legacy pot jams + sealed promises,
   *  excluding opened (those move to «Las disfrutadas») and elixirs. */
  readonly sealed = computed(() =>
    this.newestFirst().filter((p) => !isElixir(p) && isSealedJam(p) && !p.openedAt),
  );

  /** «La despedida» (0.0.95) — elixir vials, newest despedida first. Drunk and
   *  un-drunk both live here (a brindado elixir is kept as a keepsake). */
  readonly elixirs = computed(() => this.newestFirst().filter(isElixir));
}
