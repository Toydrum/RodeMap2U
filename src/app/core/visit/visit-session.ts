import { Injectable, inject, signal } from '@angular/core';
import { API_CLIENT } from '../api/api-client';
import { ApiError, ApiErrorCode, PublicProfile } from '../api/contracts';
import { VisitNodesRepo, VisitTreesRepo } from './visit-repos';

/**
 * One visit to someone else's forest — provided at the /visit/:userId route,
 * never root. Loads the snapshot from GET /users/:id/forest and feeds the
 * route-scoped repos; every component under the route (canvas, tablita,
 * node sheet, plant flows) reads and writes THIS forest through ordinary DI,
 * and not one byte touches the visitor's local IndexedDB.
 */
@Injectable()
export class VisitSession {
  private readonly api = inject(API_CLIENT);
  private readonly trees = inject(VisitTreesRepo);
  private readonly nodes = inject(VisitNodesRepo);

  private readonly userIdSignal = signal('');
  private readonly ownerSignal = signal<PublicProfile | null>(null);
  private readonly detailSignal = signal<'full' | 'stripped'>('stripped');
  private readonly loadingSignal = signal(false);
  private readonly errorSignal = signal<ApiErrorCode | null>(null);

  readonly userId = this.userIdSignal.asReadonly();
  readonly owner = this.ownerSignal.asReadonly();
  /** 'full' = guardian co-gardening (edits allowed); 'stripped' = view only. */
  readonly detail = this.detailSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();

  readonly editable = () => this.detailSignal() === 'full';

  async load(userId: string): Promise<void> {
    // Route re-entry to the same forest (the injector survives): paint the
    // snapshot we already hold, but ALWAYS revalidate in the background — a
    // branch planted from another tab/device since the last visit must show
    // up without a full reload.
    if (this.userIdSignal() === userId && this.ownerSignal()) {
      void this.refetch(userId);
      return;
    }
    this.userIdSignal.set(userId);
    this.loadingSignal.set(true);
    this.errorSignal.set(null);
    try {
      await this.refetch(userId);
    } finally {
      this.loadingSignal.set(false);
    }
  }

  private async refetch(userId: string): Promise<void> {
    try {
      const snapshot = await this.api.getForest(userId);
      this.ownerSignal.set(snapshot.owner);
      this.detailSignal.set(snapshot.detail);
      this.trees.bind(userId, snapshot.detail === 'full');
      this.nodes.bind(userId, snapshot.detail === 'full');
      this.trees.resetTo(snapshot.trees);
      this.nodes.resetTo(snapshot.nodes);
    } catch (error) {
      this.errorSignal.set(error instanceof ApiError ? error.code : 'unknown');
    }
  }
}
