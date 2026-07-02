import { Injectable, computed } from '@angular/core';
import { TimerSession, newSyncBase } from '../db/schema';
import { StoreName } from '../db/idb';
import { RecordsRepo } from './records.repo';

@Injectable({ providedIn: 'root' })
export class SessionsRepo extends RecordsRepo<TimerSession> {
  protected readonly store: StoreName = 'sessions';

  /** A session left running (e.g. app closed mid-focus). */
  readonly running = computed(() => this.all().find((s) => s.endedAt === null) ?? null);

  totalMinutesFor(nodeId: string): number {
    return Math.round(
      this.all()
        .filter((s) => s.nodeId === nodeId && s.endedAt !== null)
        .reduce((sum, s) => sum + (s.endedAt! - s.startedAt), 0) / 60_000,
    );
  }

  async start(nodeId: string | null, plannedMinutes: number): Promise<TimerSession> {
    const session: TimerSession = {
      ...newSyncBase(),
      nodeId,
      startedAt: Date.now(),
      plannedMinutes,
      endedAt: null,
      note: '',
    };
    return this.insert(session);
  }

  async end(session: TimerSession, note = ''): Promise<TimerSession> {
    return this.save({ ...session, endedAt: Date.now(), note });
  }
}
