import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { API_CLIENT } from '../api/api-client';
import { ApiError, ApiErrorCode, SyncRecord, SyncStore, lwwBeats } from '../api/contracts';
import {
  CheckIn,
  SCHEMA_VERSION,
  SyncBase,
  TimerSession,
  Tree,
  TreeNode,
} from '../db/schema';
import { get, put } from '../db/idb';
import { broadcastRemote, onLocalWrite } from '../db/broadcast';
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
  /** A backup was restored: the next sync must run the restore-wins pass. */
  forcePending?: boolean;
  /** Ids written since the last settled push — the clock-proof half of the
   *  outbound scan (a backward clock jump makes updatedAt lie to the
   *  watermark; explicit bookkeeping cannot be lied to). */
  dirty?: Partial<Record<SyncStore, string[]>>;
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
  private forcePending = false;
  /** Per-store ids awaiting a settled push — see SyncStateSnapshot.dirty. */
  private readonly dirtyIds = new Map<SyncStore, Set<string>>();
  private pushTimer: ReturnType<typeof setTimeout> | null = null;
  /** Suppresses the local-write echo while a pull applies remote records. */
  /** Debounce for persisting dirty marks outside a sync pass. */
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  /** Bumped by forgetEverything so an in-flight sync can't re-persist stale
   *  cursor/watermark over a reset. */
  private epoch = 0;
  private initialized = false;

  constructor() {
    // Signing in AFTER boot (the boot timer has long fired by then) must
    // resume syncing on its own — otherwise the ✅ card lies until the next
    // local write. Same for clearing a mismatch by switching accounts.
    let prev: SyncPhase | null = null;
    effect(() => {
      const phase = this.phase();
      const was = prev;
      prev = phase;
      if (phase === 'idle' && (was === 'off' || was === 'mismatch')) this.schedulePush();
    });
  }

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
        this.forcePending = state.forcePending ?? false;
        this.lastSyncAtSignal.set(state.lastSyncAt ?? null);
        for (const [store, ids] of Object.entries(state.dirty ?? {})) {
          this.dirtyIds.set(store as SyncStore, new Set(ids));
        }
      }
    } catch {
      /* memory-only session — sync stays off */
    }

    onLocalWrite((message) => {
      // No applyingRemote gate here: pulls broadcast via broadcastRemote
      // (cross-tab only), so everything that reaches this handler is a
      // GENUINE local write — the old gate silently dropped user writes
      // that interleaved with a pull being applied.
      // Mark ALWAYS (even signed out): if the clock jumped backward these
      // writes are invisible to the watermark, and the dirty set is what
      // still gets them pushed after the next sign-in.
      if (message.store !== 'meta') {
        const set = this.dirtyIds.get(message.store) ?? new Set<string>();
        for (const id of message.ids) set.add(id);
        this.dirtyIds.set(message.store, set);
        // …and marks must reach DISK even without a successful sync (the
        // in-memory set dies with the tab; the watermark scan can't cover a
        // backward clock — the exact case the persisted set exists for).
        this.schedulePersistState();
      }
      if (this.phase() === 'off' || this.phase() === 'mismatch') return;
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
    const epoch = this.epoch;
    try {
      if (this.forcePending) {
        this.watermark = 0; // a restore pushes EVERYTHING, and it wins
        await this.pushForceWins();
        this.forcePending = false;
      } else {
        await this.pushDirty();
      }
      await this.pullChanges();
      // A reset (forgetEverything) mid-pass: our watermark/cursor belong to
      // the OLD cloud — persisting them would make the fresh cursor silently
      // skip records, the exact failure the reset guards against.
      if (epoch !== this.epoch) return false;
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

  /** Dirty marks reach disk shortly after they're made — not only after a
   *  successful sync (a tab closed offline used to lose them all). */
  private schedulePersistState(): void {
    if (this.persistTimer) return;
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      void this.persistState();
    }, 2000);
  }

  /** Called by BackupService after an import-replace. An EXPLICIT restore
   *  must prevail over the cloud — otherwise the next pull silently undoes it
   *  (the cloud's higher revs win LWW). The flag persists, so an offline (or
   *  not-yet-connected) import still gets its restore-wins pass on the next
   *  successful sync or connect. */
  async noteRestore(): Promise<void> {
    this.forcePending = true;
    this.watermark = 0;
    await this.persistState();
    void this.syncNow(); // guards inside handle off/mismatch/offline
  }

  // ── outbound ──────────────────────────────────────────────────────────────

  private schedulePush(): void {
    if (this.pushTimer) clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => {
      this.pushTimer = null;
      void this.syncNow();
    }, PUSH_DEBOUNCE_MS);
  }

  /** Watermark scan + dirty set: everything written after the last successful
   *  push — including tombstones and archived records (a backup-grade copy). */
  private async pushDirty(): Promise<void> {
    const captureAt = Date.now();
    const dirty = this.gatherAll();
    for (let i = 0; i < dirty.length; i += PUSH_CHUNK) {
      const chunk = dirty.slice(i, i + PUSH_CHUNK);
      const result = await this.api.pushSync({ schemaVersion: SCHEMA_VERSION, records: chunk });
      // The server's winners correct us immediately (rev-LWW).
      for (const winner of result.serverRecords) await this.acceptRemote(winner);
      this.settleDirty(chunk);
    }
    this.watermark = captureAt;
  }

  /** The restore-wins pass: push everything; when the cloud out-revs a record
   *  (STALE_REV), re-stamp the local copy just PAST the cloud winner and push
   *  again — per-record restore-wins. Records the backup never knew (created
   *  elsewhere after the export) still flow back in on the pull: LWW is
   *  per-record, a restore is not a cloud wipe. */
  private async pushForceWins(): Promise<void> {
    const captureAt = Date.now();
    const dirty = this.gatherAll();
    for (let i = 0; i < dirty.length; i += PUSH_CHUNK) {
      const chunk = dirty.slice(i, i + PUSH_CHUNK);
      const result = await this.api.pushSync({ schemaVersion: SCHEMA_VERSION, records: chunk });
      if (!result.rejected.length) {
        // Fully accepted chunks settle too — skipping them left cleanly
        // restored ids marked dirty forever (redundant churn every pass).
        this.settleDirty(chunk);
        continue;
      }
      const winnerRevs = new Map(result.serverRecords.map((w) => [w.record.id, w.record.rev]));
      const retry: SyncRecord[] = [];
      for (const rejection of result.rejected) {
        const entry = chunk.find((c) => c.record.id === rejection.id);
        if (!entry) continue;
        const cloudRev = winnerRevs.get(rejection.id) ?? entry.record.rev;
        const stamped = {
          ...entry.record,
          rev: Math.max(entry.record.rev, cloudRev) + 1,
          updatedAt: Date.now(),
        };
        try {
          await put(entry.store, stamped);
        } catch {
          /* memory-only session */
        }
        this.repoOf(entry.store).applyExternal(stamped as never);
        retry.push({ store: entry.store, record: stamped });
      }
      if (retry.length) {
        await this.api.pushSync({ schemaVersion: SCHEMA_VERSION, records: retry });
      }
      this.settleDirty(chunk);
      this.settleDirty(retry);
    }
    this.watermark = captureAt;
  }

  private gatherAll(): SyncRecord[] {
    return [
      ...this.gather('trees', this.trees),
      ...this.gather('nodes', this.nodes),
      ...this.gather('checkins', this.checkins),
      ...this.gather('sessions', this.sessions),
    ];
  }

  private gather<T extends SyncBase>(store: SyncStore, repo: RecordsRepo<T>): SyncRecord[] {
    const out: SyncRecord[] = [];
    const dirty = this.dirtyIds.get(store);
    for (const record of repo.byId().values()) {
      if (record.updatedAt > this.watermark || dirty?.has(record.id)) {
        out.push({ store, record: record as unknown as Tree | TreeNode | CheckIn | TimerSession });
      }
    }
    return out;
  }

  /** Un-mark what a push settled. A record re-written DURING the push has a
   *  higher rev than the copy we sent — it stays marked for the next pass. */
  private settleDirty(pushed: SyncRecord[]): void {
    for (const entry of pushed) {
      const set = this.dirtyIds.get(entry.store);
      if (!set?.has(entry.record.id)) continue;
      const current = this.repoOf(entry.store).byId().get(entry.record.id);
      if (!current || current.rev === entry.record.rev) set.delete(entry.record.id);
    }
  }

  // ── inbound ───────────────────────────────────────────────────────────────

  private async pullChanges(): Promise<void> {
    for (let page = 0; page < MAX_PULL_PAGES; page++) {
      const batch = await this.api.getSyncChanges(this.cursor === '0' ? undefined : this.cursor);
      const touched = new Map<SyncStore, string[]>();
      for (const change of batch.changes) {
        if (await this.acceptRemote(change)) {
          const ids = touched.get(change.store) ?? [];
          ids.push(change.record.id);
          touched.set(change.store, ids);
        }
      }
      // Other tabs learn the same way they always have — but NOT this tab's
      // own sync handler (these records came FROM the server; re-marking
      // them dirty echoed a pointless full re-push after every pull).
      for (const [store, ids] of touched) broadcastRemote({ store, ids });
      this.cursor = batch.cursor;
      if (!batch.more) break;
    }
  }

  /** LWW-guarded landing: disk first, then memory — returns true if applied.
   *  Shared law (contracts.lwwBeats): exact ties go to the server's copy, so
   *  two replicas that stamped the same rev converge instead of diverging. */
  private async acceptRemote(change: SyncRecord): Promise<boolean> {
    const repo = this.repoOf(change.store);
    const incoming = change.record;
    const current = repo.byId().get(incoming.id);
    if (current && lwwBeats(current, incoming)) return false;
    try {
      await put(change.store, incoming);
    } catch {
      /* memory-only session still benefits from the in-memory apply */
    }
    repo.applyExternal(incoming as never);
    // The server's copy IS our copy now — nothing left to push for this id.
    this.dirtyIds.get(change.store)?.delete(incoming.id);
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
        forcePending: this.forcePending,
        dirty: Object.fromEntries(
          [...this.dirtyIds].filter(([, ids]) => ids.size).map(([store, ids]) => [store, [...ids]]),
        ),
      } satisfies SyncStateSnapshot);
    } catch {
      /* memory-only session */
    }
  }

  /** Practice-cloud reset (Settings): the device bookkeeping must reset WITH
   *  the cloud — a kept cursor against a reseeded feed silently skips records,
   *  and a kept link points at an account that no longer exists. */
  async forgetEverything(): Promise<void> {
    this.epoch++; // an in-flight sync must not re-persist the old cloud's cursor
    await this.disconnect();
    this.watermark = 0;
    this.cursor = '0';
    this.forcePending = false;
    this.dirtyIds.clear();
    this.lastSyncAtSignal.set(null);
    await this.persistState();
  }
}
