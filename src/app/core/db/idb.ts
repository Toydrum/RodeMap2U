import { DB_NAME, DB_VERSION, LEGACY_DB_NAME } from './schema';

/**
 * Minimal promise wrapper over IndexedDB — the only six operations this app
 * needs. Each operation runs in its own transaction, which designs out the
 * classic "transaction auto-committed while awaiting a foreign promise" bug:
 * there is simply no API surface to hold a transaction across awaits.
 * `putMany` performs all puts synchronously inside ONE transaction, giving
 * atomic multi-record writes (branch-on-miss depends on this).
 */

export type StoreName = 'trees' | 'nodes' | 'checkins' | 'sessions' | 'meta';

let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * If IndexedDB never answers (restricted/private contexts), we refuse to hang
 * the whole app: openDb rejects after a short grace period and the app runs
 * in memory-only mode for the session (repos catch and degrade gracefully).
 */
const OPEN_TIMEOUT_MS = 3000;

export function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const giveUp = setTimeout(
      () => reject(new Error('IndexedDB unavailable (open timed out)')),
      OPEN_TIMEOUT_MS,
    );
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.addEventListener('success', () => clearTimeout(giveUp));
    request.addEventListener('error', () => clearTimeout(giveUp));

    request.onupgradeneeded = () => {
      // Structural upgrades ONLY (stores/indexes). Data-shape migrations run
      // after open, driven by meta.schemaVersion — see migrations.ts.
      const db = request.result;
      if (!db.objectStoreNames.contains('trees')) {
        db.createObjectStore('trees', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('nodes')) {
        const nodes = db.createObjectStore('nodes', { keyPath: 'id' });
        nodes.createIndex('byTree', 'treeId');
      }
      if (!db.objectStoreNames.contains('checkins')) {
        const checkins = db.createObjectStore('checkins', { keyPath: 'id' });
        checkins.createIndex('byCreatedAt', 'createdAt');
      }
      if (!db.objectStoreNames.contains('sessions')) {
        const sessions = db.createObjectStore('sessions', { keyPath: 'id' });
        sessions.createIndex('byCreatedAt', 'createdAt');
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
    };

    request.onsuccess = () => {
      // One-time adoption of the pre-rename database (see schema.ts naming
      // note): copy, never move — the legacy DB stays as a safety net.
      void migrateLegacyIfNeeded(request.result).finally(() => resolve(request.result));
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('IndexedDB open blocked by another tab'));
  });
  return dbPromise;
}

const ALL_STORES: StoreName[] = ['trees', 'nodes', 'checkins', 'sessions', 'meta'];

/**
 * If this (new-name) DB is empty and the pre-rename DB exists with data,
 * copy every store across once. Fail-open: any hiccup leaves the app running
 * on the new DB, and the untouched legacy DB retries on the next boot.
 */
async function migrateLegacyIfNeeded(db: IDBDatabase): Promise<void> {
  try {
    const treeCount = await requestToPromise(
      db.transaction('trees', 'readonly').objectStore('trees').count(),
    );
    const metaCount = await requestToPromise(
      db.transaction('meta', 'readonly').objectStore('meta').count(),
    );
    if (treeCount > 0 || metaCount > 0) return; // already lived-in

    // Never CREATE the legacy DB just to look inside it.
    if (typeof indexedDB.databases === 'function') {
      const existing = await indexedDB.databases();
      if (!existing.some((d) => d.name === LEGACY_DB_NAME)) return;
    }

    const legacy = await new Promise<IDBDatabase | null>((resolve) => {
      const open = indexedDB.open(LEGACY_DB_NAME);
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => resolve(null);
    });
    if (!legacy) return;
    try {
      for (const store of ALL_STORES) {
        if (!legacy.objectStoreNames.contains(store)) continue;
        const rows = await requestToPromise<unknown[]>(
          legacy.transaction(store, 'readonly').objectStore(store).getAll(),
        );
        if (!rows.length) continue;
        const tx = db.transaction(store, 'readwrite');
        const target = tx.objectStore(store);
        for (const row of rows) target.put(row);
        await txDone(tx);
      }
    } finally {
      legacy.close();
    }
  } catch {
    // Empty start beats a blocked boot; the legacy copy is still intact.
  }
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('transaction aborted'));
  });
}

/** True once openDb has definitively failed — the session is memory-only. */
export async function storageAvailable(): Promise<boolean> {
  try {
    await openDb();
    return true;
  } catch {
    return false;
  }
}

export async function get<T>(store: StoreName, key: string): Promise<T | undefined> {
  const db = await openDb();
  return requestToPromise(db.transaction(store, 'readonly').objectStore(store).get(key));
}

export async function getAll<T>(store: StoreName): Promise<T[]> {
  const db = await openDb();
  return requestToPromise(db.transaction(store, 'readonly').objectStore(store).getAll());
}

export async function put<T>(store: StoreName, value: T): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).put(value);
  return txDone(tx);
}

/** All puts issued synchronously inside one transaction — atomic. */
export async function putMany<T>(store: StoreName, values: T[]): Promise<void> {
  if (!values.length) return;
  const db = await openDb();
  const tx = db.transaction(store, 'readwrite');
  const objectStore = tx.objectStore(store);
  for (const value of values) objectStore.put(value);
  return txDone(tx);
}

/** Import-replace only. */
export async function clear(store: StoreName): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).clear();
  return txDone(tx);
}
