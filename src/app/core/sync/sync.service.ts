import { Injectable, computed, inject, signal } from '@angular/core';
import { API_CLIENT } from '../api/api-client';
import { ApiError, ApiErrorCode, SyncRecord, SyncStore } from '../api/contracts';
import {
  CheckIn,
  SCHEMA_VERSION,
  SyncBase,
  TimerSession,
  Tree,
  TreeNode,
} from '../db/schema';
import { get, put } from '../db/idb';
import { broadcastChange, onLocalWrite } from '../db/broadcast';
import { AuthService } from '../auth/auth.service';
import { AccountLinkSnapshot, META_ACCOUNT_LINK } from '../auth/auth-types';
import { RecordsRepo } from '../repos/records.repo';
import { TreesRepo } from '../repos/trees.repo';
import { NodesRepo } from '../repos/nodes.repo';
import { CheckinsRepo } from '../repos/checkins.repo';
import { SessionsRepo } from '../repos/sessions.repo';

/**
 * «Conectar mi bosque» — the sync engine. Strictly OPT-IN: nothing leaves the
 * device until the user explicitly connects, and the connection is remembered
 * per-device in the `account.link` meta key.
 *
 * Rails (designed since 0.0.48): outbound rides `onLocalWrite` (debounced) +
 * a watermark scan that catches anything a crash left behind; inbound walks
 * the server's cursor feed into `RecordsRepo.applyExternal` (rev-LWW) with a
 * disk write guarded by the same law. Re-pushing is idempotent by contract
 * (the server rejects `rev <= stored` as STALE_REV and hands back its winner),
 * so every edge self-heals on the next pass.
 *
 * Boot stays network-free: `init()` reads two meta keys; the first pull fires
 * a few seconds later, only when online, signed in and this device's link
 * matches the signed-in account.
 */

const META_SYNC_STATE = 'sync.state';
const PUSH_DEBOUNCE_MS = 1500;
const BOOT_PULL_DELAY_MS = 3000;
const PUSH_CHUNK = 100;
const MAX_PULL_PAGES = 50;

interface SyncStateSnapshot {
  key: typeof META_SYNC_STATE;
  /** Everything with updatedAt beyond this has not been pushed yet. */
  watermark: number;
  /** Opaque server cursor — the change feed resumes after it. */
  cursor: string;
  lastSyncAt: number | null;
}

export type SyncPhase = 'off' | 'mismatch' | 'idle' | 'syncing' | 'offline' | 'error';

@Injectable({ providedIn: 'root' })
export class SyncService {
  private readonly api = inject(API_CLIENT);
  private readonly auth = inject(AuthService);
  private readonly trees = inject(TreesRepo);
  private readonly nodes = inject(NodesRepo);
  private readonly checkins = inject(CheckinsRepo);
  private readonly sessions = inject(SessionsRepo);

  private readonly linkSignal = signal<AccountLinkSnapshot | null>(null);
  private readonly busySignal = signal(false);
  private readonly lastSyncAtSignal = signal<number | null>(null);
  private readonly lastErrorSignal = signal<ApiErrorCode | null>(null);

  readonly link = this.linkSignal.asReadonly();
  readonly lastSyncAt = this.lastSyncAtSignal.asReadonly();
  readonly lastError = this.lastErrorSignal.asReadonly();

  /** The single state the UI paints from. */
  readonly phase = computed<SyncPhase>(() => {
    const link = this.linkSignal();
    if (!link?.accountId) return 'off';
    const user = this.auth.user();
    if (!user) return 'off';
    if (link.accountId !== user.userId) return 'mismatch';
    if (this.busySignal()) return 'syncing';
    if (this.lastErrorSignal() === 'offline') return 'offline';
    if (this.lastErrorSignal()) return 'error';
    return 'idle';
  });

  private watermark = 0;
  private cursor = '0';
  private pushTimer: ReturnType<typeof setTimeout> | null = null;
  /** Suppresses the local-write echo while a pull applies remote records. */
  private applyingRemote = false;
  private initialized = false;

  /** App initializer — meta reads only, zero network, fail-open. */
  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    try {
      const [link, state] = await Promise.all([
        get<AccountLinkSnapshot>('meta', META_ACCOUNT_LINK),
        get<SyncStateSnapshot>('meta', META_SYNC_STATE),
      ]);
      if (link) this.linkSignal.set(link);
      if (state) {
        this.watermark = state.watermark ?? 0;
        this.cursor = state.cursor ?? '0';
        this.lastSyncAtSignal.set(state.lastSyncAt ?? null);
      }
    } catch {
      /* memory-only session — sync stays off */
    }

    onLocalWrite(() => {
      if (this.applyingRemote || this.phase() === 'off' || this.phase() === 'mismatch') return;
      this.schedulePush();
    });
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => void this.syncNow());
    }
    setTimeout(() => {
      if (this.phase() === 'idle') void this.syncNow();
    }, BOOT_PULL_DELAY_MS);
  }

  /** The explicit opt-in: full push of this device's forest, then adoption of
   *  whatever the account's cloud already holds (LWW merges both ways). */
  async connect(): Promise<boolean> {
    const user = this.auth.user();
    if (!user) return false;
    const link: AccountLinkSnapshot = {
      key: META_ACCOUNT_LINK,
      accountId: user.userId,
      linkedAt: Date.now(),
      uploadedAt: null,
    };
    this.watermark = 0; // everything this device holds goes up
    this.cursor = '0'; // and everything the account holds comes down
    await this.persistLink(link);
    await this.persistState();
    const ok = await this.syncNow();
    if (ok) {
      await this.persistLink({ ...link, uploadedAt: Date.now() });
    }
    return ok;
  }

  /** Lets go of the device↔account link. Local data is untouched. */
  async disconnect(): Promise<void> {
    const current = this.linkSignal();
    await this.persistLink({
      key: META_ACCOUNT_LINK,
      accountId: null,
      linkedAt: current?.linkedAt ?? Date.now(),
      uploadedAt: null,
    });
    this.lastErrorSignal.set(null);
  }

  async syncNow(): Promise<boolean> {
    if (this.phase() === 'off' || this.phase() === 'mismatch' || this.busySignal()) return false;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.lastErrorSignal.set('offline');
      return false;
    }
    this.busySignal.set(true);
    this.lastErrorSignal.set(null);
    try {
      await this.pushDirty();
      await this.pullChanges();
      this.lastSyncAtSignal.set(Date.now());
      await this.persistState();
      return true;
    } catch (error) {
      this.lastErrorSignal.set(error instanceof ApiError ? error.code : 'unknown');
      return false;
    } finally {
      this.busySignal.set(false);
    }
  }

  // ── outbound ──────────────────────────────────────────────────────────────

  private schedulePush(): void {
    if (this.pushTimer) clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => {
      this.pushTimer = null;
      void this.syncNow();
    }, PUSH_DEBOUNCE_MS);
  }

  /** Watermark scan: everything written after the last successful push —
   *  including tombstones and archived records (a backup-grade copy). */
  private async pushDirty(): Promise<void> {
    const captureAt = Date.now();
    const dirty: SyncRecord[] = [
      ...this.gather('trees', this.trees),
      ...this.gather('nodes', this.nodes),
      ...this.gather('checkins', this.checkins),
      ...this.gather('sessions', this.sessions),
    ];
    for (let i = 0; i < dirty.length; i += PUSH_CHUNK) {
      const result = await this.api.pushSync({
        schemaVersion: SCHEMA_VERSION,
        records: dirty.slice(i, i + PUSH_CHUNK),
      });
      // The server's winners correct us immediately (rev-LWW).
      for (const winner of result.serverRecords) await this.acceptRemote(winner);
    }
    this.watermark = captureAt;
  }

  private gather<T extends SyncBase>(store: SyncStore, repo: RecordsRepo<T>): SyncRecord[] {
    const out: SyncRecord[] = [];
    for (const record of repo.byId().values()) {
      if (record.updatedAt > this.watermark) {
        out.push({ store, record: record as unknown as Tree | TreeNode | CheckIn | TimerSession });
      }
    }
    return out;
  }

  // ── inbound ───────────────────────────────────────────────────────────────

  private async pullChanges(): Promise<void> {
    for (let page = 0; page < MAX_PULL_PAGES; page++) {
      const batch = await this.api.getSyncChanges(this.cursor === '0' ? undefined : this.cursor);
      const touched = new Map<SyncStore, string[]>();
      this.applyingRemote = true;
      try {
        for (const change of batch.changes) {
          if (await this.acceptRemote(change)) {
            const ids = touched.get(change.store) ?? [];
            ids.push(change.record.id);
            touched.set(change.store, ids);
          }
        }
      } finally {
        this.applyingRemote = false;
      }
      // Other tabs learn the same way they always have.
      for (const [store, ids] of touched) broadcastChange({ store, ids });
      this.cursor = batch.cursor;
      if (!batch.more) break;
    }
  }

  /** LWW-guarded landing: disk first, then memory — returns true if applied. */
  private async acceptRemote(change: SyncRecord): Promise<boolean> {
    const repo = this.repoOf(change.store);
    const incoming = change.record;
    const current = repo.byId().get(incoming.id);
    if (current && current.rev >= incoming.rev) return false;
    try {
      await put(change.store, incoming);
    } catch {
      /* memory-only session still benefits from the in-memory apply */
    }
    repo.applyExternal(incoming as never);
    return true;
  }

  private repoOf(store: SyncStore): RecordsRepo<SyncBase> {
    switch (store) {
      case 'trees':
        return this.trees as unknown as RecordsRepo<SyncBase>;
      case 'nodes':
        return this.nodes as unknown as RecordsRepo<SyncBase>;
      case 'checkins':
        return this.checkins as unknown as RecordsRepo<SyncBase>;
      case 'sessions':
        return this.sessions as unknown as RecordsRepo<SyncBase>;
    }
  }

  // ── persistence ───────────────────────────────────────────────────────────

  private async persistLink(link: AccountLinkSnapshot): Promise<void> {
    this.linkSignal.set(link);
    try {
      await put('meta', link);
    } catch {
      /* memory-only session */
    }
  }

  private async persistState(): Promise<void> {
    try {
      await put('meta', {
        key: META_SYNC_STATE,
        watermark: this.watermark,
        cursor: this.cursor,
        lastSyncAt: this.lastSyncAtSignal(),
      } satisfies SyncStateSnapshot);
    } catch {
      /* memory-only session */
    }
  }
}
