import { Injectable, effect, inject } from '@angular/core';
import { PromiseService } from './promise.service';

/**
 * «La promesa» (0.0.93) — the convergence watcher, eagerly constructed in App.
 *
 * The local place() path seals a goal jar the moment its own placement reaches
 * capacity (with the modest celebration). This watcher only ever catches jars
 * filled from OUTSIDE that path — the rare multi-device case where two devices
 * each placed the "last" fruit and neither sealed locally, or a crash between a
 * placement and its seal. It seals them SILENTLY (ceremony-free, deterministic
 * stamps) so both devices converge by LWW.
 *
 * It never mints fruit and never celebrates — sealing an already-full jar is
 * convergence bookkeeping, not a user reward. Idempotent + guarded by sealedAt,
 * and the async write is scheduled off the effect's read pass so there is no
 * read→write→read loop (after the seal the jar leaves `pending`, and the next
 * effect run finds nothing).
 */
@Injectable({ providedIn: 'root' })
export class PromiseReconcilerService {
  private readonly promise = inject(PromiseService);
  private running = false;

  constructor() {
    effect(() => {
      const overfull = this.promise
        .pending()
        .some((jar) => this.promise.membersOf(jar.id).length >= this.promise.capacity(jar.size));
      if (!overfull || this.running) return;
      this.running = true;
      queueMicrotask(async () => {
        try {
          await this.promise.reconcile();
        } finally {
          this.running = false;
        }
      });
    });
  }
}
