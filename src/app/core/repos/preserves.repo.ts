import { Injectable, computed } from '@angular/core';
import { Preserve } from '../db/schema';
import { StoreName } from '../db/idb';
import { RecordsRepo } from './records.repo';

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
}
